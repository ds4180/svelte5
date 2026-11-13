import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * ============================================================================
 * [SvelteKit 테스트 파일 업로드 백엔드 엔드포인트 (스트리밍 + 청크 분할)]
 * ============================================================================
 * - DB 및 별도 인덱스 파일 없이 전용 폴더(${UPLOAD_DIR}/svelte_test)에 직접 저장/조회/삭제합니다.
 * - 단일 파일 스트리밍(POST)과 대용량 청크 분할 업로드(action=init/chunk/complete)를 모두 지원합니다.
 * - hooks.server.js의 정적 파일 우회 조건(pathname.includes('.'))을 피하기 위해
 *   파일명과 action은 URL 경로가 아닌 쿼리 파라미터(?name=..., ?action=...)로 전달합니다.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHUNK_DIR_NAME = '.chunks';
const MAX_TOTAL_CHUNKS = 5000;
const MAX_TOTAL_CHUNKED_SIZE = 2 * 1024 * 1024 * 1024; // 테스트용 최대 2GB

// 실행 파일 업로드만 최소 차단 (테스트용 이미지/문서/압축/동영상 등은 자유롭게 허용)
const BLOCKED_EXTENSIONS = new Set([
	'.exe',
	'.msi',
	'.bat',
	'.cmd',
	'.sh',
	'.dll',
	'.com',
	'.scr',
	'.php',
	'.phtml'
]);

const MIME_MAP: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
	'.ico': 'image/x-icon',
	'.svg': 'image/svg+xml',
	'.pdf': 'application/pdf',
	'.txt': 'text/plain; charset=utf-8',
	'.log': 'text/plain; charset=utf-8',
	'.csv': 'text/csv; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.zip': 'application/zip',
	'.7z': 'application/x-7z-compressed',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.mov': 'video/quicktime',
	'.mkv': 'video/x-matroska',
	'.mp3': 'audio/mpeg'
};

// 브라우저에서 직접 렌더링해도 스크립트 실행 위험이 없는 미리보기 허용 확장자
const INLINE_SAFE_EXTENSIONS = new Set([
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.bmp',
	'.ico',
	'.pdf',
	'.txt',
	'.log',
	'.csv',
	'.json',
	'.mp4',
	'.webm',
	'.mp3'
]);

interface ChunkSessionMeta {
	uploadId: string;
	originalName: string;
	mimeType: string;
	totalSize: number;
	chunkSize: number;
	totalChunks: number;
	ownerKey: string;
	createdAt: string;
}

function getUploadDir(): string {
	const base = process.env.UPLOAD_DIR || env.UPLOAD_DIR || '/app/uploads';
	return path.resolve(base, 'svelte_test');
}

function getMaxRequestSize(): number {
	return Number(process.env.BODY_SIZE_LIMIT || env.BODY_SIZE_LIMIT || 100 * 1024 * 1024);
}

function getUserOwnerKey(user: NonNullable<App.Locals['user']>): string {
	return user.username || String(user.id || 'user');
}

async function ensureUploadDir(): Promise<string> {
	const uploadDir = getUploadDir();
	await fs.mkdir(uploadDir, { recursive: true });
	return uploadDir;
}

function requireUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, '로그인이 필요합니다.');
	}
	return locals.user;
}

function assertAllowedExtension(fileName: string) {
	const ext = path.extname(fileName || '').toLowerCase();
	if (BLOCKED_EXTENSIONS.has(ext)) {
		throw error(400, `보안상 허용되지 않는 파일 형식입니다: ${fileName}`);
	}
}

/**
 * 업로드 파일명 정제 + 타임스탬프/랜덤 접두사 부여 (덮어쓰기 및 특수문자 문제 방지)
 */
function buildStoredFileName(originalName: string): string {
	const rawBase = path.basename(originalName || 'file').normalize('NFC');
	const rawExt = path.extname(rawBase);
	const ext = rawExt.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 16).toLowerCase();
	const rawStem = rawExt ? rawBase.slice(0, -rawExt.length) : rawBase;

	// 한글/영문/숫자/일부 안전한 기호 외 문자는 '_'로 치환하고 선행 점 제거
	const safeStem = rawStem
		.replace(/[^\p{L}\p{N}._-]+/gu, '_')
		.replace(/^\.+/, '')
		.slice(0, 80);

	const stem = safeStem || 'file';
	const suffix = crypto.randomBytes(3).toString('hex');
	return `${Date.now()}_${suffix}_${stem}${ext}`;
}

/**
 * 쿼리 파라미터로 받은 파일명의 경로 이탈(Path Traversal) 엄격 차단
 */
function resolveSafeFilePath(
	uploadDir: string,
	rawName: string | null
): { fileName: string; fullPath: string } | null {
	if (!rawName) return null;
	const fileName = path.basename(rawName);
	if (!fileName || fileName === '.' || fileName === '..' || fileName !== rawName) {
		return null;
	}
	const fullPath = path.resolve(uploadDir, fileName);
	if (!fullPath.startsWith(uploadDir + path.sep)) {
		return null;
	}
	return { fileName, fullPath };
}

/**
 * 청크 세션 ID 검증 및 격리된 임시 폴더 경로 계산
 */
function resolveSafeChunkDir(uploadDir: string, uploadId: string | null): string | null {
	if (!uploadId || !UUID_REGEX.test(uploadId)) return null;
	const chunkRoot = path.resolve(uploadDir, CHUNK_DIR_NAME);
	const workDir = path.resolve(chunkRoot, uploadId);
	if (!workDir.startsWith(chunkRoot + path.sep)) return null;
	return workDir;
}

async function readChunkMeta(
	uploadDir: string,
	uploadId: string | null,
	user: NonNullable<App.Locals['user']>
): Promise<{ workDir: string; meta: ChunkSessionMeta }> {
	const workDir = resolveSafeChunkDir(uploadDir, uploadId);
	if (!workDir) {
		throw error(400, '유효하지 않은 uploadId입니다.');
	}

	let meta: ChunkSessionMeta;
	try {
		const raw = await fs.readFile(path.join(workDir, 'meta.json'), 'utf-8');
		meta = JSON.parse(raw) as ChunkSessionMeta;
	} catch (err) {
		const nodeErr = err as NodeJS.ErrnoException;
		if (nodeErr?.code === 'ENOENT') {
			throw error(404, '진행 중인 청크 업로드 세션을 찾을 수 없습니다.');
		}
		throw error(500, '청크 세션 메타데이터를 읽을 수 없습니다.');
	}

	if (meta.ownerKey !== getUserOwnerKey(user)) {
		throw error(403, '본인이 시작한 업로드 세션만 조작할 수 있습니다.');
	}

	return { workDir, meta };
}

function getMimeType(fileName: string): string {
	const ext = path.extname(fileName).toLowerCase();
	return MIME_MAP[ext] || 'application/octet-stream';
}

function buildContentDisposition(fileName: string, forceDownload: boolean): string {
	const ext = path.extname(fileName).toLowerCase();
	const mode = forceDownload || !INLINE_SAFE_EXTENSIONS.has(ext) ? 'attachment' : 'inline';
	return `${mode}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

async function streamWebFileToDisk(file: File, targetPath: string): Promise<void> {
	const webStream = file.stream() as unknown as import('node:stream/web').ReadableStream<Uint8Array>;
	const nodeReadable = Readable.fromWeb(webStream);
	await pipeline(nodeReadable, createWriteStream(targetPath));
}

/**
 * 청크 업로드 1단계: 초기화 (임시 작업 폴더 생성 및 메타 검증/저장)
 */
async function handleChunkInit(
	user: NonNullable<App.Locals['user']>,
	request: Request,
	uploadDir: string,
	maxRequestSize: number
) {
	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		throw error(400, '초기화 요청 본문(JSON)이 올바르지 않습니다.');
	}

	const originalName = String(payload.originalName || '').trim();
	const totalSize = Number(payload.totalSize);
	const chunkSize = Number(payload.chunkSize);
	const mimeType = String(payload.mimeType || '').trim();

	if (!originalName) {
		throw error(400, '파일명이 비어 있습니다.');
	}
	assertAllowedExtension(originalName);

	if (!Number.isFinite(totalSize) || totalSize <= 0 || totalSize > MAX_TOTAL_CHUNKED_SIZE) {
		throw error(
			400,
			`허용 파일 크기(최대 ${Math.round(MAX_TOTAL_CHUNKED_SIZE / (1024 * 1024 * 1024))}GB)를 벗어났습니다.`
		);
	}
	if (!Number.isFinite(chunkSize) || chunkSize <= 0 || chunkSize > maxRequestSize) {
		throw error(
			400,
			`청크 크기는 1바이트 ~ ${Math.round(maxRequestSize / (1024 * 1024))}MB 사이여야 합니다.`
		);
	}

	const totalChunks = Math.ceil(totalSize / chunkSize);
	if (totalChunks < 1 || totalChunks > MAX_TOTAL_CHUNKS) {
		throw error(400, `분할 청크 개수가 허용 한도(${MAX_TOTAL_CHUNKS}개)를 초과했습니다.`);
	}

	const uploadId = crypto.randomUUID();
	const workDir = resolveSafeChunkDir(uploadDir, uploadId);
	if (!workDir) {
		throw error(500, '청크 작업 폴더 생성에 실패했습니다.');
	}

	await fs.mkdir(workDir, { recursive: true });
	const meta: ChunkSessionMeta = {
		uploadId,
		originalName,
		mimeType: mimeType || getMimeType(originalName),
		totalSize,
		chunkSize,
		totalChunks,
		ownerKey: getUserOwnerKey(user),
		createdAt: new Date().toISOString()
	};
	await fs.writeFile(path.join(workDir, 'meta.json'), JSON.stringify(meta), 'utf-8');

	return json({
		uploadId,
		totalChunks,
		chunkSize
	});
}

/**
 * 청크 업로드 2단계: 개별 조각을 임시 .tmp로 스트리밍 수신 후 원자적 .part 확정
 */
async function handleChunkPart(
	user: NonNullable<App.Locals['user']>,
	request: Request,
	uploadDir: string,
	maxRequestSize: number
) {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		throw error(400, '청크 FormData를 해석할 수 없습니다.');
	}

	const uploadId = String(formData.get('uploadId') || '');
	const index = Number(formData.get('index'));
	const chunkEntry = formData.get('chunk');

	const { workDir, meta } = await readChunkMeta(uploadDir, uploadId, user);

	if (!Number.isInteger(index) || index < 0 || index >= meta.totalChunks) {
		throw error(400, `유효하지 않은 청크 인덱스입니다: ${index}`);
	}
	if (!(chunkEntry instanceof File) || chunkEntry.size <= 0) {
		throw error(400, '청크 파일 데이터가 비어 있습니다.');
	}
	if (chunkEntry.size > maxRequestSize || chunkEntry.size > meta.chunkSize) {
		throw error(413, '청크 크기가 약정된 분할 크기를 초과했습니다.');
	}

	const partName = `${String(index).padStart(6, '0')}.part`;
	const partPath = path.join(workDir, partName);
	const tmpPartPath = `${partPath}.tmp`;

	try {
		await streamWebFileToDisk(chunkEntry, tmpPartPath);
		await fs.rename(tmpPartPath, partPath);
	} catch (err) {
		await fs.unlink(tmpPartPath).catch(() => {});
		console.error(`❌ [Chunk Upload] Failed writing chunk ${index}:`, err);
		throw error(500, `${index + 1}번 청크 저장 중 오류가 발생했습니다.`);
	}

	return json({
		ok: true,
		uploadId,
		index,
		size: chunkEntry.size
	});
}

/**
 * 청크 업로드 3단계: 0 ~ totalChunks-1 조각을 64KB 스트림으로 이어 붙여 최종 저장
 */
async function handleChunkComplete(
	user: NonNullable<App.Locals['user']>,
	request: Request,
	uploadDir: string
) {
	let payload: Record<string, unknown>;
	try {
		payload = (await request.json()) as Record<string, unknown>;
	} catch {
		throw error(400, '완료 요청 본문(JSON)이 올바르지 않습니다.');
	}

	const uploadId = String(payload.uploadId || '');
	const { workDir, meta } = await readChunkMeta(uploadDir, uploadId, user);
	const mergedTempPath = path.join(workDir, 'merged.bin');

	try {
		// 병합 전 모든 청크 파일 존재 여부 사전 확인
		for (let i = 0; i < meta.totalChunks; i++) {
			const partPath = path.join(workDir, `${String(i).padStart(6, '0')}.part`);
			try {
				await fs.stat(partPath);
			} catch {
				throw error(400, `${i + 1}번 청크가 누락되어 병합할 수 없습니다.`);
			}
		}

		const out = createWriteStream(mergedTempPath);
		let streamError: Error | null = null;
		out.on('error', (err) => {
			streamError = err;
		});

		const hash = crypto.createHash('sha256');
		let writtenBytes = 0;

		try {
			for (let i = 0; i < meta.totalChunks; i++) {
				if (streamError) throw streamError;
				const partPath = path.join(workDir, `${String(i).padStart(6, '0')}.part`);
				for await (const rawBuf of createReadStream(partPath)) {
					if (streamError) throw streamError;
					const buf = rawBuf as Buffer;
					hash.update(buf);
					writtenBytes += buf.byteLength;
					if (!out.write(buf)) {
						await new Promise<void>((res) => out.once('drain', res));
					}
				}
			}

			await new Promise<void>((res, rej) => {
				if (streamError) {
					rej(streamError);
					return;
				}
				out.once('error', rej);
				out.end(() => res());
			});
		} catch (err) {
			out.destroy();
			throw err;
		}

		if (writtenBytes !== meta.totalSize) {
			throw error(
				400,
				`병합된 파일 크기(${writtenBytes})가 원본 크기(${meta.totalSize})와 일치하지 않습니다.`
			);
		}

		const storedName = buildStoredFileName(meta.originalName);
		const finalTargetPath = path.resolve(uploadDir, storedName);
		if (!finalTargetPath.startsWith(uploadDir + path.sep)) {
			throw error(400, '잘못된 저장 경로입니다.');
		}

		// 동일 볼륨(/app/uploads/svelte_test) 내부 이동이므로 용량이 커도 즉시 완료
		await fs.rename(mergedTempPath, finalTargetPath);
		const mimeType = meta.mimeType || getMimeType(storedName);
		const sha256 = hash.digest('hex');

		return json(
			{
				success: true,
				mode: 'chunked',
				uploadDir,
				uploadedBy: getUserOwnerKey(user),
				count: 1,
				files: [
					{
						originalName: meta.originalName,
						savedName: storedName,
						size: writtenBytes,
						mimeType,
						isImage: mimeType.startsWith('image/'),
						isVideo: mimeType.startsWith('video/'),
						chunkSize: meta.chunkSize,
						totalChunks: meta.totalChunks,
						sha256,
						path: finalTargetPath
					}
				]
			},
			{ status: 201 }
		);
	} finally {
		await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
	}
}

/**
 * 단일 파일 스트리밍 업로드 (기존 action 없는 multipart POST 하위 호환)
 */
async function handleDirectUpload(
	user: NonNullable<App.Locals['user']>,
	request: Request,
	uploadDir: string,
	maxRequestSize: number
) {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch (err) {
		console.error('❌ [Svelte Upload POST] FormData parse error:', err);
		throw error(400, '업로드 요청 본문을 해석할 수 없습니다. 파일 크기 제한을 확인하세요.');
	}

	const rawEntries = [...formData.getAll('files'), ...formData.getAll('file')];
	const files = rawEntries.filter((entry): entry is File => entry instanceof File && entry.size > 0);

	if (files.length === 0) {
		throw error(400, '업로드할 파일이 선택되지 않았습니다.');
	}

	const savedFiles = [];

	for (const file of files) {
		assertAllowedExtension(file.name);
		if (file.size > maxRequestSize) {
			throw error(
				413,
				`파일 크기가 제한(${Math.round(maxRequestSize / (1024 * 1024))}MB)을 초과했습니다: ${file.name}`
			);
		}

		const storedName = buildStoredFileName(file.name);
		const targetPath = path.resolve(uploadDir, storedName);
		if (!targetPath.startsWith(uploadDir + path.sep)) {
			throw error(400, '잘못된 저장 경로입니다.');
		}

		try {
			await streamWebFileToDisk(file, targetPath);
		} catch (err) {
			await fs.unlink(targetPath).catch(() => {});
			console.error('❌ [Svelte Upload POST] Disk write error:', err);
			throw error(500, `파일 저장 실패: ${file.name}`);
		}

		const mimeType = file.type || getMimeType(storedName);
		savedFiles.push({
			originalName: file.name,
			savedName: storedName,
			size: file.size,
			mimeType,
			isImage: mimeType.startsWith('image/'),
			isVideo: mimeType.startsWith('video/'),
			path: targetPath
		});
	}

	return json(
		{
			success: true,
			mode: 'direct',
			uploadDir,
			uploadedBy: getUserOwnerKey(user),
			count: savedFiles.length,
			files: savedFiles
		},
		{ status: 201 }
	);
}

/**
 * GET /v1/pages/uploadfile/files
 * - ?name 없으면: svelte_test 폴더 내 파일 목록 반환
 * - ?name=... 있으면: 스트리밍 + HTTP Range(206) 지원 파일 서빙
 */
export const GET: RequestHandler = async ({ locals, url, request }) => {
	requireUser(locals);
	const uploadDir = await ensureUploadDir();
	const maxRequestSize = getMaxRequestSize();

	const targetName = url.searchParams.get('name');
	if (!targetName) {
		const entries = await fs.readdir(uploadDir, { withFileTypes: true });
		const fileStats = await Promise.all(
			entries
				.filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
				.map(async (entry) => {
					const fullPath = path.join(uploadDir, entry.name);
					const stat = await fs.stat(fullPath);
					const mimeType = getMimeType(entry.name);
					return {
						name: entry.name,
						size: stat.size,
						mimeType,
						isImage: mimeType.startsWith('image/'),
						isVideo: mimeType.startsWith('video/'),
						updatedAt: stat.mtime.toISOString(),
						mtimeMs: stat.mtimeMs
					};
				})
		);

		fileStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
		const files = fileStats.map(({ mtimeMs: _mtimeMs, ...rest }) => rest);

		return json({
			uploadDir,
			maxFileSize: MAX_TOTAL_CHUNKED_SIZE,
			maxRequestSize,
			files
		});
	}

	const resolved = resolveSafeFilePath(uploadDir, targetName);
	if (!resolved) {
		throw error(400, '유효하지 않은 파일명입니다.');
	}

	let stat: Awaited<ReturnType<typeof fs.stat>>;
	try {
		stat = await fs.stat(resolved.fullPath);
		if (!stat.isFile()) {
			throw error(404, '파일을 찾을 수 없습니다.');
		}
	} catch (err) {
		const nodeErr = err as NodeJS.ErrnoException;
		if (nodeErr?.code === 'ENOENT') {
			throw error(404, '파일을 찾을 수 없습니다.');
		}
		if ((err as { status?: number })?.status) throw err;
		console.error('❌ [Svelte Upload GET] Stat error:', err);
		throw error(500, '파일 정보를 읽는 중 오류가 발생했습니다.');
	}

	const forceDownload = url.searchParams.get('download') === '1';
	const mimeType = getMimeType(resolved.fileName);
	const disposition = buildContentDisposition(resolved.fileName, forceDownload);
	const rangeHeader = request.headers.get('range');

	// 동영상 탐색(Seek) 등을 위한 HTTP Range (206 Partial Content) 처리
	if (rangeHeader && stat.size > 0) {
		const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
		if (!match || (!match[1] && !match[2])) {
			return new Response(null, {
				status: 416,
				headers: { 'Content-Range': `bytes */${stat.size}` }
			});
		}

		const start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
		const end = match[1] && match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;

		if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start >= stat.size || start > end) {
			return new Response(null, {
				status: 416,
				headers: { 'Content-Range': `bytes */${stat.size}` }
			});
		}

		const webStream = Readable.toWeb(
			createReadStream(resolved.fullPath, { start, end })
		) as unknown as BodyInit;

		return new Response(webStream, {
			status: 206,
			headers: {
				'Content-Type': mimeType,
				'Content-Length': String(end - start + 1),
				'Content-Range': `bytes ${start}-${end}/${stat.size}`,
				'Accept-Ranges': 'bytes',
				'Content-Disposition': disposition,
				'X-Content-Type-Options': 'nosniff',
				'Cache-Control': 'no-store'
			}
		});
	}

	const webStream = Readable.toWeb(createReadStream(resolved.fullPath)) as unknown as BodyInit;
	return new Response(webStream, {
		status: 200,
		headers: {
			'Content-Type': mimeType,
			'Content-Length': String(stat.size),
			'Accept-Ranges': 'bytes',
			'Content-Disposition': disposition,
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'no-store'
		}
	});
};

/**
 * POST /v1/pages/uploadfile/files
 * - ?action=init | chunk | complete : 청크 분할 스트리밍 업로드
 * - action 없음 : 단일 요청 멀티파트 스트리밍 업로드
 */
export const POST: RequestHandler = async ({ locals, request, url }) => {
	const user = requireUser(locals);
	const uploadDir = await ensureUploadDir();
	const maxRequestSize = getMaxRequestSize();
	const action = url.searchParams.get('action');

	if (action === 'init') {
		return handleChunkInit(user, request, uploadDir, maxRequestSize);
	}
	if (action === 'chunk') {
		return handleChunkPart(user, request, uploadDir, maxRequestSize);
	}
	if (action === 'complete') {
		return handleChunkComplete(user, request, uploadDir);
	}
	if (action) {
		throw error(400, `지원하지 않는 업로드 action입니다: ${action}`);
	}

	return handleDirectUpload(user, request, uploadDir, maxRequestSize);
};

/**
 * DELETE /v1/pages/uploadfile/files
 * - ?uploadId=... : 중단된 청크 업로드 임시 폴더 정리
 * - ?name=...     : svelte_test 폴더 내 완료 파일 삭제
 */
export const DELETE: RequestHandler = async ({ locals, url }) => {
	const user = requireUser(locals);
	const uploadDir = await ensureUploadDir();

	const uploadId = url.searchParams.get('uploadId');
	if (uploadId) {
		const { workDir } = await readChunkMeta(uploadDir, uploadId, user);
		await fs.rm(workDir, { recursive: true, force: true });
		return json({
			success: true,
			abortedUploadId: uploadId
		});
	}

	const resolved = resolveSafeFilePath(uploadDir, url.searchParams.get('name'));
	if (!resolved) {
		throw error(400, '삭제할 파일명이 올바르지 않습니다.');
	}

	try {
		await fs.unlink(resolved.fullPath);
		return json({
			success: true,
			deleted: resolved.fileName
		});
	} catch (err) {
		const nodeErr = err as NodeJS.ErrnoException;
		if (nodeErr?.code === 'ENOENT') {
			throw error(404, '이미 삭제되었거나 존재하지 않는 파일입니다.');
		}
		console.error('❌ [Svelte Upload DELETE] Unlink error:', err);
		throw error(500, '파일 삭제 중 오류가 발생했습니다.');
	}
};
