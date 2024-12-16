/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { parse } from 'cookie'

interface WorkerEnv extends Env {
  uid: string
  secret: string
}

interface Link {
	path: string
	text: string
	class: string
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (!checkCookie(env, request.headers))
			return new Response('Forbidden', { status: 403 })

		const url = new URL(request.url)
    const key = decodeURIComponent(url.pathname.slice(1))

		return key.split('/').length === 1 ? list(env, key) : detail(env, key)
	}
} satisfies ExportedHandler<WorkerEnv>

const parts = (key: string) => {
	const parts = key.split('/')
	if (parts.length < 3) return [...parts, '', '', '' ].slice(0, 3)
	return [parts[0], parts[1], parts.slice(2).join('/').replace('.html', '')]
}

const list = async (env: Env, key: string) => {
	const ret = await env.MY_BUCKET.list({
		prefix: key,
		include: ['customMetadata', 'httpMetadata'],
	})

	let links: Link[] = []
	if (!key) {
		const uniq: Record<string, number> = {}
		ret.objects.forEach(obj => {
			const [ course ] = parts(obj.key)
			if (!course) return
			if (!uniq[course]) uniq[course] = 0
			uniq[course]++
		})
		links = Object.keys(uniq).map(course => ({
			path: course, text: `${course} (${uniq[course]})`, class: 'course'
		}))
	} else {
		let chapter = ''
		ret.objects.forEach(obj => {
			const [ _, curChapter, text ] = parts(obj.key)
			if (curChapter != chapter) {
				chapter = curChapter
				links.push({path: '#', text: chapter, class: 'chapter' })
			}
			links.push({ path: obj.key, text, class: 'lecture' })
		})
	}

	const html = render(links)
	return new Response(html, {headers: {
		'content-type': 'text/html; charset=UTF-8',
	}})
}

const render = (links: Link[]) => {
	const content = links.map(link => `
		<div class="link">
			<a class="${link.class}" href="/${link.path}">${link.text}</a>
		</div>
	`).join('')

	return `
	<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Document</title>
			<style>
				.link { margin-bottom: 10px; }
				.link a { text-decoration: none; color: #333; }
				.course { font-size: 18px; }
				.chapter { font-size: 18px; pointer-events: none; }
				.lecture { padding-left: 50px; font-size: 16px; }
				.lecture:visited { color: #aaa3a3; }
				.link a:hover { color: #7a77e0; }
			</style>
		</head>
		<body>
			${content}
		</body>
	</html>
	`
}

const detail = async (env: Env, key: string) => {
	const obj = await env.MY_BUCKET.get(key)

	if (!obj)
		return new Response('Not Found', { status: 404 })

	const headers = new Headers()
	obj.writeHttpMetadata(headers)
	headers.set('etag', obj.httpEtag)

	return new Response(obj.body, {headers})
}

const checkCookie = (env: WorkerEnv, headers: Headers) => {
	const cookie = parse(headers.get("Cookie") || "")
	return cookie._uid === env.uid && cookie._secret === env.secret
}
