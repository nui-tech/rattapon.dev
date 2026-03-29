# rattapon.dev

Personal portfolio site for [Nui Rattapon](https://rattapon.dev) — Senior Full-Stack Engineer based in Christchurch, NZ.

## Stack

- **Next.js 16** — App Router, static export (`output: "export"`)
- **Three.js** — Southern Cross (Te Kāhui o Matariki) constellation hero animation
- **Tailwind CSS v4** — styling
- **Web3Forms + hCaptcha** — contact form with spam protection
- **Cloudflare Pages** — hosting

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create a `.env.local` file with your Web3Forms key:

```env
NEXT_PUBLIC_WEB3FORMS_KEY=your_key_here
```

## Build

```bash
npm run build   # outputs to /out
```

Deployed automatically via Cloudflare Pages on push to `main`.
