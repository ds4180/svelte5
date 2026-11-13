import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DELETE, GET, POST } from './+server';

describe('/v1/pages/uploadfile/files 백엔드 핸들러 (단일 + 청크 분할)', () => {
	let tempBaseDir = '';
	let prevUploadDir: string | undefined;

	const mockUser = {
		id: 1,
		username: 'tester',
		real_name: '테스터'
	};

	const otherUser = {
		id: 2,
		username: 'other',
		real_name: '다른사용자'
	};

	function createEvent(
		urlStr: string,
		options: {
			user?: typeof mockUser | null;
			formData?: FormData;
			jsonBody?: unknown;
			headers?: Record<string, string>;
		} = {}
	) {
		const url = new URL(urlStr, 'https://dev.jeju.live');
		const locals = {
			user: options.user === undefined ? mockUser : (options.user as any)
		} as App.Locals;

		let request: Request;
		if (options.formData) {
			request = {
				formData: async () => options.formData!
			} as unknown as Request;
		} else if (options.jsonBody !== undefined) {
			request = new Request(url.toString(), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(options.headers || {})
				},
				body: JSON.stringify(options.jsonBody)
			});
		} else {
			request = new Request(url.toString(), {
				headers: options.headers
			});
		}

		return { url, locals, request } as any;
	}

	beforeAll(async () => {
		prevUploadDir = process.env.UPLOAD_DIR;
		tempBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'svelte-upload-chunk-'));
		process.env.UPLOAD_DIR = tempBaseDir;
	});

	afterAll(async () => {
		if (prevUploadDir === undefined) {
			delete process.env.UPLOAD_DIR;
		} else {
			process.env.UPLOAD_DIR = prevUploadDir;
		}
		if (tempBaseDir) {
			await fs.rm(tempBaseDir, { recursive: true, force: true });
		}
	});

	it('비로그인 요청은 401을 반환해야 합니다', async () => {
		await expect(
			GET(createEvent('/v1/pages/uploadfile/files', { user: null }))
		).rejects.toMatchObject({ status: 401 });

		await expect(
			POST(
				createEvent('/v1/pages/uploadfile/files?action=init', {
					user: null,
					jsonBody: { originalName: 'a.mp4', totalSize: 100, chunkSize: 50 }
				})
			)
		).rejects.toMatchObject({ status: 401 });
	});

	it('청크 분할 업로드(init -> chunk*N -> complete) 후 원본과 SHA-256이 일치하고 HTTP Range(206) 서빙이 동작해야 합니다', async () => {
		// 25KB 가상 바이너리 데이터를 10KB 단위(3조각: 10KB + 10KB + 5KB)로 분할
		const payloadBytes = crypto.randomBytes(25 * 1024);
		const expectedSha256 = crypto.createHash('sha256').update(payloadBytes).digest('hex');
		const chunkSize = 10 * 1024;

		// 1. init
		const initRes = await POST(
			createEvent('/v1/pages/uploadfile/files?action=init', {
				jsonBody: {
					originalName: '샘플 영상.mp4',
					totalSize: payloadBytes.byteLength,
					chunkSize,
					mimeType: 'video/mp4'
				}
			})
		);
		expect(initRes.status).toBe(200);
		const { uploadId, totalChunks } = await initRes.json();
		expect(totalChunks).toBe(3);

		// 타 사용자 접근 차단 확인 (403)
		await expect(
			POST(
				createEvent('/v1/pages/uploadfile/files?action=complete', {
					user: otherUser,
					jsonBody: { uploadId }
				})
			)
		).rejects.toMatchObject({ status: 403 });

		// 2. chunk 전송
		for (let i = 0; i < totalChunks; i++) {
			const start = i * chunkSize;
			const end = Math.min(start + chunkSize, payloadBytes.byteLength);
			const fd = new FormData();
			fd.append('uploadId', uploadId);
			fd.append('index', String(i));
			fd.append('chunk', new File([payloadBytes.subarray(start, end)], `part_${i}`));

			const chunkRes = await POST(
				createEvent('/v1/pages/uploadfile/files?action=chunk', { formData: fd })
			);
			expect(chunkRes.status).toBe(200);
		}

		// 3. complete
		const completeRes = await POST(
			createEvent('/v1/pages/uploadfile/files?action=complete', {
				jsonBody: { uploadId }
			})
		);
		expect(completeRes.status).toBe(201);
		const completeBody = await completeRes.json();
		expect(completeBody.mode).toBe('chunked');
		expect(completeBody.files[0].size).toBe(payloadBytes.byteLength);
		expect(completeBody.files[0].sha256).toBe(expectedSha256);

		const savedName: string = completeBody.files[0].savedName;

		// 임시 청크 폴더는 자동 삭제되어야 함
		await expect(
			fs.stat(path.join(tempBaseDir, 'svelte_test', '.chunks', uploadId))
		).rejects.toMatchObject({ code: 'ENOENT' });

		// 목록 조회에서 숨김(.chunks) 없이 1개 정상 표시 확인
		const listRes = await GET(createEvent('/v1/pages/uploadfile/files'));
		const listBody = await listRes.json();
		expect(listBody.files.map((f: any) => f.name)).toContain(savedName);
		expect(listBody.files[0].isVideo).toBe(true);

		// 4. Range (206 Partial Content) 바이트 구간 검증
		const rangeRes = await GET(
			createEvent(`/v1/pages/uploadfile/files?name=${encodeURIComponent(savedName)}`, {
				headers: { Range: 'bytes=0-127' }
			})
		);
		expect(rangeRes.status).toBe(206);
		expect(rangeRes.headers.get('content-range')).toBe(
			`bytes 0-127/${payloadBytes.byteLength}`
		);
		const sliced = new Uint8Array(await rangeRes.arrayBuffer());
		expect(Buffer.from(sliced).equals(payloadBytes.subarray(0, 128))).toBe(true);

		// 5. 전체 바이트 일치 & 삭제
		const fullRes = await GET(
			createEvent(`/v1/pages/uploadfile/files?name=${encodeURIComponent(savedName)}`)
		);
		expect(fullRes.status).toBe(200);
		const downloaded = Buffer.from(await fullRes.arrayBuffer());
		expect(downloaded.equals(payloadBytes)).toBe(true);

		const delRes = await DELETE(
			createEvent(`/v1/pages/uploadfile/files?name=${encodeURIComponent(savedName)}`)
		);
		expect(delRes.status).toBe(200);
	});

	it('청크 취소(DELETE ?uploadId=...) 시 임시 폴더가 정리되고, 누락 청크 병합 시 400을 반환해야 합니다', async () => {
		const initRes = await POST(
			createEvent('/v1/pages/uploadfile/files?action=init', {
				jsonBody: {
					originalName: 'incomplete.zip',
					totalSize: 2048,
					chunkSize: 1024,
					mimeType: 'application/zip'
				}
			})
		);
		const { uploadId } = await initRes.json();

		// 0번 청크만 보내고 complete 시도 -> 400
		const fd = new FormData();
		fd.append('uploadId', uploadId);
		fd.append('index', '0');
		fd.append('chunk', new File([crypto.randomBytes(1024)], 'part_0'));
		await POST(createEvent('/v1/pages/uploadfile/files?action=chunk', { formData: fd }));

		await expect(
			POST(
				createEvent('/v1/pages/uploadfile/files?action=complete', {
					jsonBody: { uploadId }
				})
			)
		).rejects.toMatchObject({ status: 400 });

		// 새로운 세션 init 후 DELETE 취소 테스트
		const init2 = await POST(
			createEvent('/v1/pages/uploadfile/files?action=init', {
				jsonBody: {
					originalName: 'abort.zip',
					totalSize: 1024,
					chunkSize: 512,
					mimeType: 'application/zip'
				}
			})
		);
		const { uploadId: uploadId2 } = await init2.json();
		const abortRes = await DELETE(
			createEvent(`/v1/pages/uploadfile/files?uploadId=${uploadId2}`)
		);
		expect(abortRes.status).toBe(200);
		await expect(
			fs.stat(path.join(tempBaseDir, 'svelte_test', '.chunks', uploadId2))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('기존 단일 multipart POST 스트리밍 업로드와 경로 이탈 차단이 계속 동작해야 합니다', async () => {
		const fd = new FormData();
		fd.append('files', new File(['hello stream'], 'memo.txt', { type: 'text/plain' }));

		const postRes = await POST(createEvent('/v1/pages/uploadfile/files', { formData: fd }));
		expect(postRes.status).toBe(201);
		const body = await postRes.json();
		expect(body.mode).toBe('direct');
		const savedName = body.files[0].savedName;

		const getRes = await GET(
			createEvent(`/v1/pages/uploadfile/files?name=${encodeURIComponent(savedName)}`)
		);
		expect(await getRes.text()).toBe('hello stream');

		await expect(
			GET(createEvent('/v1/pages/uploadfile/files?name=../.env'))
		).rejects.toMatchObject({ status: 400 });

		const badFd = new FormData();
		badFd.append('files', new File(['#!/bin/sh'], 'evil.sh', { type: 'application/x-sh' }));
		await expect(
			POST(createEvent('/v1/pages/uploadfile/files', { formData: badFd }))
		).rejects.toMatchObject({ status: 400 });
	});
});
