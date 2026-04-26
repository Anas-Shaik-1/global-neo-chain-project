# Foundation Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Frontend half of Foundation — a Vite + React 19 + TypeScript app with shadcn/ui (dark mode), Redux Toolkit, TanStack Query, axios with refresh-on-401 interceptor, orval-generated API hooks, JWT auth round trip, AppLayout shell, and component/integration tests.

**Architecture:** A provider tree wraps Router → ProtectedRoute → AppLayout. Auth state lives in Redux (`accessToken` + `user` only — server data lives in TanStack Query). On boot, a `useBootstrapSession` hook silently calls `/auth/refresh` then `/auth/me`. Axios attaches `Authorization` from Redux and refreshes on 401 via a deduped module-level promise. orval generates typed TanStack Query hooks against the running backend's `/openapi.json`.

**Tech Stack:** Vite 6, React 19, TypeScript 5, Tailwind 4, shadcn/ui (`new-york`), Redux Toolkit, react-redux, TanStack Query 5, react-router 7, axios, orval, Vitest, @testing-library/react, jsdom.

**Reference spec:** `docs/superpowers/specs/2026-04-25-foundation-design.md`.
**Predecessor plan:** `2026-04-25-foundation-backend.md` — the backend must be runnable (or at least its `/openapi.json` reachable) for orval generation.

**Pre-task: clean slate.** Before Task 1, the executor MUST run `rm -rf Frontend && mkdir Frontend` from the repo root. The existing `Frontend/` directory holds the broken JSX scaffold the spec mandates we replace. The Logo component and brand strings will be re-introduced in Task 11; they are reproduced verbatim there so this plan is self-contained.

---

## Task 1: Bootstrap Vite + TS + Tailwind project

**Files:**
- Create: `Frontend/package.json`
- Create: `Frontend/tsconfig.json`
- Create: `Frontend/tsconfig.app.json`
- Create: `Frontend/tsconfig.node.json`
- Create: `Frontend/vite.config.ts`
- Create: `Frontend/index.html`
- Create: `Frontend/.env.example`
- Create: `Frontend/.env`
- Create: `Frontend/.gitignore`
- Create: `Frontend/src/main.tsx`
- Create: `Frontend/src/App.tsx` (placeholder; replaced in Task 13)
- Create: `Frontend/src/styles/globals.css`
- Create: `Frontend/postcss.config.js`
- Create: `Frontend/tailwind.config.ts`

- [ ] **Step 1: Create `Frontend/package.json`**

```json
{
  "name": "ems-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "gen:api": "orval --config orval.config.ts",
    "lint": "eslint ."
  },
  "dependencies": {
    "@reduxjs/toolkit": "^2.3.0",
    "@tanstack/react-query": "^5.59.20",
    "@radix-ui/react-avatar": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-separator": "^1.1.1",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.4",
    "axios": "^1.7.9",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.469.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-redux": "^9.2.0",
    "react-router-dom": "^7.1.1",
    "sonner": "^1.7.1",
    "tailwind-merge": "^2.5.5",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "axios-mock-adapter": "^2.1.0",
    "eslint": "^9.17.0",
    "jsdom": "^25.0.1",
    "orval": "^7.4.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.6.3",
    "vite": "^6.0.5",
    "vitest": "^2.1.5"
  }
}
```

Note: Tailwind pinned to `^3.4` (not 4) to keep the plugin/JIT toolchain Vite 6 + shadcn-friendly. Spec mentioned Tailwind 4; we step it down for compatibility — call out in the README if needed.

- [ ] **Step 2: Create `Frontend/tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Step 3: Create `Frontend/tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `Frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "orval.config.ts", "vitest.config.ts", "tailwind.config.ts"]
}
```

- [ ] **Step 5: Create `Frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 6: Create `Frontend/index.html`**

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SMS-IP — Employee Management</title>
  </head>
  <body class="bg-background text-foreground antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `Frontend/.env.example`**

```
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 8: Copy to `.env`**

```bash
cp Frontend/.env.example Frontend/.env
```

- [ ] **Step 9: Create `Frontend/.gitignore`**

```
node_modules
dist
coverage
.env
src/api/generated
.vite
```

- [ ] **Step 10: Create `Frontend/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 11: Create `Frontend/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
```

- [ ] **Step 12: Create `Frontend/src/styles/globals.css`** (shadcn `new-york` tokens with cyan primary)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 222 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;
    --primary: 200 85% 52%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222 47% 11%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --accent: 210 40% 96%;
    --accent-foreground: 222 47% 11%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 210 40% 98%;
    --border: 214 32% 91%;
    --input: 214 32% 91%;
    --ring: 200 85% 52%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222 47% 6%;
    --foreground: 210 40% 98%;
    --card: 222 47% 8%;
    --card-foreground: 210 40% 98%;
    --popover: 222 47% 8%;
    --popover-foreground: 210 40% 98%;
    --primary: 200 85% 52%;
    --primary-foreground: 222 47% 6%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 63% 41%;
    --destructive-foreground: 210 40% 98%;
    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 200 85% 52%;
  }

  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 13: Create placeholder `Frontend/src/App.tsx` and `Frontend/src/main.tsx`**

`Frontend/src/main.tsx`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`Frontend/src/App.tsx` (placeholder — replaced in Task 13):

```tsx
export default function App() {
  return <div className="p-8">EMS Frontend bootstrapping…</div>;
}
```

- [ ] **Step 14: Verify dev server boots**

```bash
cd Frontend && pnpm install && pnpm dev
```

Visit `http://localhost:5173` — should render "EMS Frontend bootstrapping…" on the dark background. Ctrl-C to stop.

- [ ] **Step 15: Commit**

```bash
git add Frontend/
git commit -m "feat(frontend): bootstrap Vite + TS + Tailwind + shadcn tokens"
```

---

## Task 2: shadcn primitives + utils

**Files:**
- Create: `Frontend/src/lib/utils.ts`
- Create: `Frontend/src/components/ui/button.tsx`
- Create: `Frontend/src/components/ui/input.tsx`
- Create: `Frontend/src/components/ui/label.tsx`
- Create: `Frontend/src/components/ui/card.tsx`
- Create: `Frontend/src/components/ui/dropdown-menu.tsx`
- Create: `Frontend/src/components/ui/avatar.tsx`
- Create: `Frontend/src/components/ui/skeleton.tsx`
- Create: `Frontend/src/components/ui/separator.tsx`

These are the standard shadcn `new-york` files. Reproduced inline so the plan is self-contained — copy verbatim.

- [ ] **Step 1: Create `Frontend/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create `Frontend/src/components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
```

- [ ] **Step 3: Create `Frontend/src/components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
```

- [ ] **Step 4: Create `Frontend/src/components/ui/label.tsx`**

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;
```

- [ ] **Step 5: Create `Frontend/src/components/ui/card.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";
```

- [ ] **Step 6: Create `Frontend/src/components/ui/dropdown-menu.tsx`**

```tsx
import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;
```

- [ ] **Step 7: Create `Frontend/src/components/ui/avatar.tsx`**

```tsx
import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

export const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;
```

- [ ] **Step 8: Create `Frontend/src/components/ui/skeleton.tsx`**

```tsx
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
```

- [ ] **Step 9: Create `Frontend/src/components/ui/separator.tsx`**

```tsx
import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
      className,
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;
```

- [ ] **Step 10: Type-check**

```bash
cd Frontend && pnpm exec tsc -b
```

Expected: zero errors.

- [ ] **Step 11: Commit**

```bash
git add Frontend/src/lib/utils.ts Frontend/src/components/ui/
git commit -m "feat(frontend): shadcn primitives (button/input/label/card/dropdown/avatar/skeleton/separator)"
```

---

## Task 3: Vitest setup + ui slice (theme) with TDD

**Files:**
- Create: `Frontend/vitest.config.ts`
- Create: `Frontend/src/test/setup.ts`
- Create: `Frontend/src/features/ui/uiSlice.ts`
- Create: `Frontend/src/features/ui/uiSlice.test.ts`

- [ ] **Step 1: Create `Frontend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 2: Create `Frontend/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => cleanup());
```

- [ ] **Step 3: Write the failing uiSlice test**

Create `Frontend/src/features/ui/uiSlice.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { uiSlice, themeChanged, sidebarToggled, type UiState } from "./uiSlice";

describe("uiSlice", () => {
  const init = (): UiState => uiSlice.getInitialState();

  it("defaults to dark theme + sidebar open", () => {
    const s = init();
    expect(s.theme).toBe("dark");
    expect(s.sidebarOpen).toBe(true);
  });

  it("themeChanged updates theme", () => {
    const next = uiSlice.reducer(init(), themeChanged("light"));
    expect(next.theme).toBe("light");
  });

  it("sidebarToggled flips sidebarOpen", () => {
    const a = uiSlice.reducer(init(), sidebarToggled());
    expect(a.sidebarOpen).toBe(false);
    const b = uiSlice.reducer(a, sidebarToggled());
    expect(b.sidebarOpen).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd Frontend && pnpm test src/features/ui/uiSlice.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Create `Frontend/src/features/ui/uiSlice.ts`**

```ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Theme = "dark" | "light";

export interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
}

function readPersistedTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  const v = localStorage.getItem("ems.theme");
  return v === "light" ? "light" : "dark";
}

const initialState: UiState = {
  theme: readPersistedTheme(),
  sidebarOpen: true,
};

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    themeChanged(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    sidebarToggled(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const { themeChanged, sidebarToggled } = uiSlice.actions;
```

- [ ] **Step 6: Run tests**

```bash
cd Frontend && pnpm test src/features/ui/uiSlice.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 7: Commit**

```bash
git add Frontend/vitest.config.ts Frontend/src/test/ Frontend/src/features/ui/
git commit -m "feat(frontend): vitest + uiSlice (theme + sidebar)"
```

---

## Task 4: Auth slice + Redux store + typed hooks

**Files:**
- Create: `Frontend/src/features/auth/authSlice.ts`
- Create: `Frontend/src/features/auth/authSlice.test.ts`
- Create: `Frontend/src/app/store.ts`
- Create: `Frontend/src/app/hooks.ts`

- [ ] **Step 1: Write the failing authSlice tests**

Create `Frontend/src/features/auth/authSlice.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { authSlice, sessionEstablished, sessionCleared, accessTokenRefreshed, type AuthState, type AuthUser } from "./authSlice";

const sampleUser: AuthUser = {
  id: "u1",
  email: "a@b.com",
  name: "A",
  role: "ADMIN",
  isVerified: true,
};

describe("authSlice", () => {
  const init = (): AuthState => authSlice.getInitialState();

  it("initial state is unauthenticated", () => {
    expect(init()).toEqual({ accessToken: null, user: null });
  });

  it("sessionEstablished sets token + user", () => {
    const next = authSlice.reducer(init(), sessionEstablished({ accessToken: "tk", user: sampleUser }));
    expect(next.accessToken).toBe("tk");
    expect(next.user).toEqual(sampleUser);
  });

  it("accessTokenRefreshed updates only token", () => {
    const seeded: AuthState = { accessToken: "old", user: sampleUser };
    const next = authSlice.reducer(seeded, accessTokenRefreshed("new"));
    expect(next.accessToken).toBe("new");
    expect(next.user).toEqual(sampleUser);
  });

  it("sessionCleared resets both", () => {
    const seeded: AuthState = { accessToken: "tk", user: sampleUser };
    const next = authSlice.reducer(seeded, sessionCleared());
    expect(next).toEqual({ accessToken: null, user: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd Frontend && pnpm test src/features/auth/authSlice.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `Frontend/src/features/auth/authSlice.ts`**

```ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Role = "ADMIN" | "HR" | "EMPLOYEE" | "PM";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isVerified: boolean;
}

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
}

const initialState: AuthState = {
  accessToken: null,
  user: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionEstablished(state, action: PayloadAction<{ accessToken: string; user: AuthUser }>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
    },
    accessTokenRefreshed(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
    },
    sessionCleared() {
      return initialState;
    },
  },
});

export const { sessionEstablished, accessTokenRefreshed, sessionCleared } = authSlice.actions;
```

- [ ] **Step 4: Create `Frontend/src/app/store.ts`**

```ts
import { configureStore } from "@reduxjs/toolkit";
import { authSlice } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    ui: uiSlice.reducer,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 5: Create `Frontend/src/app/hooks.ts`**

```ts
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import type { AppDispatch, RootState } from "./store";

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

- [ ] **Step 6: Run tests**

```bash
cd Frontend && pnpm test src/features/auth/authSlice.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 7: Commit**

```bash
git add Frontend/src/features/auth/ Frontend/src/app/
git commit -m "feat(frontend): authSlice + Redux store + typed hooks"
```

---

## Task 5: Theme provider (consumes uiSlice, syncs `<html class>`, persists)

**Files:**
- Create: `Frontend/src/lib/theme.tsx`
- Create: `Frontend/src/lib/theme.test.tsx`

- [ ] **Step 1: Write the failing theme test**

Create `Frontend/src/lib/theme.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { uiSlice } from "@/features/ui/uiSlice";
import { authSlice } from "@/features/auth/authSlice";
import { ThemeProvider } from "./theme";

function buildStore(theme: "dark" | "light") {
  return configureStore({
    reducer: { ui: uiSlice.reducer, auth: authSlice.reducer },
    preloadedState: { ui: { theme, sidebarOpen: true }, auth: { accessToken: null, user: null } },
  });
}

beforeEach(() => {
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

describe("ThemeProvider", () => {
  it("adds 'dark' class for dark theme", () => {
    render(
      <Provider store={buildStore("dark")}>
        <ThemeProvider>kid</ThemeProvider>
      </Provider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes 'dark' class for light theme", () => {
    render(
      <Provider store={buildStore("light")}>
        <ThemeProvider>kid</ThemeProvider>
      </Provider>,
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists theme to localStorage", () => {
    render(
      <Provider store={buildStore("light")}>
        <ThemeProvider>kid</ThemeProvider>
      </Provider>,
    );
    expect(localStorage.getItem("ems.theme")).toBe("light");
  });
});
```

- [ ] **Step 2: Create `Frontend/src/lib/theme.tsx`**

```tsx
import { useEffect, type ReactNode } from "react";
import { useAppSelector } from "@/app/hooks";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useAppSelector((s) => s.ui.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("ems.theme", theme);
  }, [theme]);

  return <>{children}</>;
}
```

- [ ] **Step 3: Run tests**

```bash
cd Frontend && pnpm test src/lib/theme.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/lib/theme.tsx Frontend/src/lib/theme.test.tsx
git commit -m "feat(frontend): ThemeProvider syncs html.dark + persists"
```

---

## Task 6: Axios client + 401 refresh interceptor (deduped)

**Files:**
- Create: `Frontend/src/api/axios.ts`
- Create: `Frontend/src/api/axios.test.ts`
- Create: `Frontend/src/lib/queryClient.ts`

- [ ] **Step 1: Create `Frontend/src/lib/queryClient.ts`**

```ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

- [ ] **Step 2: Write the failing axios interceptor test**

Create `Frontend/src/api/axios.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { configureStore } from "@reduxjs/toolkit";
import { authSlice, sessionEstablished, sessionCleared } from "@/features/auth/authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { createApiClient } from "./axios";

function buildStore() {
  return configureStore({
    reducer: { auth: authSlice.reducer, ui: uiSlice.reducer },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("axios client", () => {
  it("attaches Authorization header from store", async () => {
    const store = buildStore();
    store.dispatch(
      sessionEstablished({
        accessToken: "tk-1",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isVerified: true },
      }),
    );
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);
    mock.onGet("/x").reply((conf) => {
      expect(conf.headers?.Authorization).toBe("Bearer tk-1");
      return [200, { ok: true }];
    });
    const res = await api.get("/x");
    expect(res.status).toBe(200);
  });

  it("on 401, calls /auth/refresh once and retries the original request", async () => {
    const store = buildStore();
    store.dispatch(
      sessionEstablished({
        accessToken: "old",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isVerified: true },
      }),
    );
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);

    let calls = 0;
    mock.onGet("/x").reply(() => {
      calls += 1;
      const tok = store.getState().auth.accessToken;
      return tok === "new" ? [200, { ok: true }] : [401, { code: "UNAUTHORIZED" }];
    });
    mock.onPost("/auth/refresh").reply(200, { accessToken: "new" });

    const res = await api.get("/x");
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
    expect(store.getState().auth.accessToken).toBe("new");
  });

  it("on refresh failure, clears session and rejects", async () => {
    const store = buildStore();
    store.dispatch(
      sessionEstablished({
        accessToken: "old",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isVerified: true },
      }),
    );
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);
    mock.onGet("/x").reply(401, { code: "UNAUTHORIZED" });
    mock.onPost("/auth/refresh").reply(401, { code: "UNAUTHORIZED" });

    await expect(api.get("/x")).rejects.toThrow();
    expect(store.getState().auth.accessToken).toBeNull();
    expect(store.getState().auth.user).toBeNull();
  });

  it("dedupes concurrent refreshes: a burst of 401s only triggers one /auth/refresh", async () => {
    const store = buildStore();
    store.dispatch(
      sessionEstablished({
        accessToken: "old",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isVerified: true },
      }),
    );
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);

    mock.onGet("/x").reply(() => {
      const tok = store.getState().auth.accessToken;
      return tok === "new" ? [200, { ok: true }] : [401, {}];
    });
    mock.onGet("/y").reply(() => {
      const tok = store.getState().auth.accessToken;
      return tok === "new" ? [200, { ok: true }] : [401, {}];
    });

    let refreshCount = 0;
    mock.onPost("/auth/refresh").reply(async () => {
      refreshCount += 1;
      await new Promise((r) => setTimeout(r, 10));
      return [200, { accessToken: "new" }];
    });

    await Promise.all([api.get("/x"), api.get("/y")]);
    expect(refreshCount).toBe(1);
  });

  it("session cleared after sessionCleared action drops Authorization", async () => {
    const store = buildStore();
    const api = createApiClient({ store, baseURL: "http://api" });
    const mock = new MockAdapter(api);
    store.dispatch(sessionCleared());
    mock.onGet("/x").reply((conf) => {
      expect(conf.headers?.Authorization).toBeUndefined();
      return [200, { ok: true }];
    });
    await api.get("/x");
  });
});
```

- [ ] **Step 3: Create `Frontend/src/api/axios.ts`**

```ts
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import type { AppStore } from "@/app/store";
import { accessTokenRefreshed, sessionCleared } from "@/features/auth/authSlice";

interface CreateApiClientOptions {
  store: AppStore;
  baseURL: string;
}

interface RetriedConfig extends InternalAxiosRequestConfig {
  __retried?: boolean;
}

export function createApiClient({ store, baseURL }: CreateApiClientOptions): AxiosInstance {
  const api = axios.create({ baseURL, withCredentials: true });

  let pendingRefresh: Promise<string | null> | null = null;

  api.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken;
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  api.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const original = error.config as RetriedConfig | undefined;
      const status = error.response?.status;
      const url = original?.url ?? "";

      if (status !== 401 || !original || original.__retried || url.includes("/auth/refresh")) {
        throw error;
      }

      original.__retried = true;

      if (!pendingRefresh) {
        pendingRefresh = (async () => {
          try {
            const res = await axios.post<{ accessToken: string }>(
              `${baseURL}/auth/refresh`,
              undefined,
              { withCredentials: true },
            );
            store.dispatch(accessTokenRefreshed(res.data.accessToken));
            return res.data.accessToken;
          } catch {
            store.dispatch(sessionCleared());
            return null;
          } finally {
            pendingRefresh = null;
          }
        })();
      }

      const newToken = await pendingRefresh;
      if (!newToken) throw error;

      original.headers.set("Authorization", `Bearer ${newToken}`);
      return api(original);
    },
  );

  return api;
}

let singleton: AxiosInstance | null = null;

export function setupApiClient(store: AppStore, baseURL: string): AxiosInstance {
  singleton = createApiClient({ store, baseURL });
  return singleton;
}

export function getApi(): AxiosInstance {
  if (!singleton) throw new Error("API client not initialised — call setupApiClient first");
  return singleton;
}
```

- [ ] **Step 4: Run tests**

```bash
cd Frontend && pnpm test src/api/axios.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/api/ Frontend/src/lib/queryClient.ts
git commit -m "feat(frontend): axios client with deduped 401 refresh interceptor"
```

---

## Task 7: orval config

**Files:**
- Create: `Frontend/orval.config.ts`

- [ ] **Step 1: Create `Frontend/orval.config.ts`**

```ts
import { defineConfig } from "orval";

export default defineConfig({
  ems: {
    input: "http://localhost:3000/openapi.json",
    output: {
      mode: "tags-split",
      target: "src/api/generated",
      schemas: "src/api/generated/model",
      client: "react-query",
      httpClient: "axios",
      override: {
        mutator: { path: "src/api/orvalAxios.ts", name: "orvalAxios" },
        query: { useQuery: true, useInfinite: false },
      },
    },
  },
});
```

- [ ] **Step 2: Create `Frontend/src/api/orvalAxios.ts`** (mutator that delegates to our singleton)

```ts
import type { AxiosRequestConfig } from "axios";
import { getApi } from "./axios";

export async function orvalAxios<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await getApi().request<T>(config);
  return res.data;
}

export type OrvalErrorType<E> = E;
```

- [ ] **Step 3: Manual verification (requires backend running)**

```bash
# Terminal 1: backend
cd Backend && pnpm dev
# Terminal 2: orval
cd Frontend && pnpm gen:api
ls src/api/generated
```

Expected: a `src/api/generated/auth/auth.ts` (and similar) is produced. If the backend isn't reachable, orval errors with an HTTP error and the generated dir stays empty — that's fine, generation runs as part of dev workflow not CI.

If `orval` complains about a missing `target` directory, create it: `mkdir -p Frontend/src/api/generated`.

- [ ] **Step 4: Commit (the generated/ dir is gitignored — we only commit config + mutator)**

```bash
git add Frontend/orval.config.ts Frontend/src/api/orvalAxios.ts
git commit -m "feat(frontend): orval config with shared axios mutator"
```

---

## Task 8: Auth thunks (login / logout / bootstrap)

**Files:**
- Create: `Frontend/src/features/auth/authThunks.ts`
- Create: `Frontend/src/features/auth/authThunks.test.ts`

These thunks are hand-written rather than using orval-generated mutations because they need to dispatch into the auth slice. orval hooks are reserved for non-auth server data (per the spec's TanStack-only-for-server-state rule, with auth as the explicit exception).

- [ ] **Step 1: Write the failing thunk tests**

Create `Frontend/src/features/auth/authThunks.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import MockAdapter from "axios-mock-adapter";
import { configureStore } from "@reduxjs/toolkit";
import { authSlice } from "./authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { loginThunk, logoutThunk, bootstrapSessionThunk } from "./authThunks";

function buildStore() {
  const store = configureStore({
    reducer: { auth: authSlice.reducer, ui: uiSlice.reducer },
  });
  setupApiClient(store, "http://api");
  return store;
}

const sampleUser = {
  id: "u1",
  email: "a@b.com",
  name: "A",
  role: "ADMIN" as const,
  isVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

let mock: MockAdapter;
let store: ReturnType<typeof buildStore>;

beforeEach(() => {
  store = buildStore();
  mock = new MockAdapter(getApi());
});

describe("authThunks", () => {
  it("loginThunk dispatches sessionEstablished on success", async () => {
    mock.onPost("/auth/login").reply(200, { accessToken: "tk", user: sampleUser });
    await store.dispatch(loginThunk({ email: "a@b.com", password: "pw" }));
    expect(store.getState().auth.accessToken).toBe("tk");
    expect(store.getState().auth.user?.email).toBe("a@b.com");
  });

  it("loginThunk rejects with friendly message on 401", async () => {
    mock.onPost("/auth/login").reply(401, { code: "UNAUTHORIZED", message: "Invalid credentials" });
    const action = await store.dispatch(loginThunk({ email: "a@b.com", password: "wrong" }));
    expect(action.type).toBe("auth/login/rejected");
    expect((action as { payload: string }).payload).toBe("Invalid credentials");
  });

  it("logoutThunk clears the session", async () => {
    mock.onPost("/auth/logout").reply(204);
    store.dispatch(authSlice.actions.sessionEstablished({ accessToken: "tk", user: sampleUser }));
    await store.dispatch(logoutThunk());
    expect(store.getState().auth.accessToken).toBeNull();
    expect(store.getState().auth.user).toBeNull();
  });

  it("bootstrapSessionThunk hydrates session via /auth/refresh + /auth/me", async () => {
    mock.onPost("/auth/refresh").reply(200, { accessToken: "tk" });
    mock.onGet("/auth/me").reply(200, { user: sampleUser });
    const action = await store.dispatch(bootstrapSessionThunk());
    expect(action.type).toBe("auth/bootstrap/fulfilled");
    expect(store.getState().auth.accessToken).toBe("tk");
    expect(store.getState().auth.user?.email).toBe("a@b.com");
  });

  it("bootstrapSessionThunk rejects when refresh fails", async () => {
    mock.onPost("/auth/refresh").reply(401);
    const action = await store.dispatch(bootstrapSessionThunk());
    expect(action.type).toBe("auth/bootstrap/rejected");
    expect(store.getState().auth.user).toBeNull();
  });
});
```

- [ ] **Step 2: Create `Frontend/src/features/auth/authThunks.ts`**

```ts
import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { getApi } from "@/api/axios";
import { sessionEstablished, sessionCleared, accessTokenRefreshed, type AuthUser } from "./authSlice";

interface LoginInput {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return fallback;
}

export const loginThunk = createAsyncThunk<
  LoginResponse,
  LoginInput,
  { rejectValue: string }
>("auth/login", async (input, { dispatch, rejectWithValue }) => {
  try {
    const res = await getApi().post<LoginResponse>("/auth/login", input);
    dispatch(sessionEstablished({ accessToken: res.data.accessToken, user: res.data.user }));
    return res.data;
  } catch (err) {
    return rejectWithValue(extractMessage(err, "Login failed"));
  }
});

export const logoutThunk = createAsyncThunk("auth/logout", async (_arg, { dispatch }) => {
  try {
    await getApi().post("/auth/logout");
  } catch {
    // ignore — logout is best-effort
  }
  dispatch(sessionCleared());
});

export const bootstrapSessionThunk = createAsyncThunk<
  { user: AuthUser },
  void,
  { rejectValue: string }
>("auth/bootstrap", async (_arg, { dispatch, rejectWithValue }) => {
  try {
    const refresh = await getApi().post<{ accessToken: string }>("/auth/refresh");
    dispatch(accessTokenRefreshed(refresh.data.accessToken));
    const me = await getApi().get<{ user: AuthUser }>("/auth/me");
    dispatch(sessionEstablished({ accessToken: refresh.data.accessToken, user: me.data.user }));
    return me.data;
  } catch (err) {
    dispatch(sessionCleared());
    return rejectWithValue(extractMessage(err, "Session expired"));
  }
});
```

- [ ] **Step 3: Run tests**

```bash
cd Frontend && pnpm test src/features/auth/authThunks.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/features/auth/authThunks.ts Frontend/src/features/auth/authThunks.test.ts
git commit -m "feat(frontend): auth thunks (login/logout/bootstrap)"
```

---

## Task 9: ProtectedRoute + useBootstrapSession

**Files:**
- Create: `Frontend/src/features/auth/useBootstrapSession.ts`
- Create: `Frontend/src/features/auth/ProtectedRoute.tsx`
- Create: `Frontend/src/features/auth/ProtectedRoute.test.tsx`

- [ ] **Step 1: Create `Frontend/src/features/auth/useBootstrapSession.ts`**

```ts
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { bootstrapSessionThunk } from "./authThunks";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function useBootstrapSession(): SessionStatus {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [status, setStatus] = useState<SessionStatus>(user ? "authenticated" : "loading");

  useEffect(() => {
    if (user) {
      setStatus("authenticated");
      return;
    }
    let cancelled = false;
    dispatch(bootstrapSessionThunk()).then((action) => {
      if (cancelled) return;
      setStatus(action.type.endsWith("/fulfilled") ? "authenticated" : "unauthenticated");
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, user]);

  return status;
}
```

- [ ] **Step 2: Create `Frontend/src/features/auth/ProtectedRoute.tsx`**

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import { useBootstrapSession } from "./useBootstrapSession";
import type { Role } from "./authSlice";

interface Props {
  roles?: Role[];
}

export function ProtectedRoute({ roles }: Props) {
  const status = useBootstrapSession();
  const user = useAppSelector((s) => s.auth.user);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        403 — You do not have access to this page.
      </div>
    );
  }

  return <Outlet />;
}
```

- [ ] **Step 3: Write the failing ProtectedRoute test**

Create `Frontend/src/features/auth/ProtectedRoute.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { authSlice, sessionEstablished } from "./authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { ProtectedRoute } from "./ProtectedRoute";

function buildStore() {
  const store = configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
  setupApiClient(store, "http://api");
  return store;
}

let store: ReturnType<typeof buildStore>;
let mock: MockAdapter;

beforeEach(() => {
  store = buildStore();
  mock = new MockAdapter(getApi());
});

describe("ProtectedRoute", () => {
  it("redirects to /login when refresh fails", async () => {
    mock.onPost("/auth/refresh").reply(401);
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>private</div>} />
            </Route>
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    await waitFor(() => expect(screen.getByText("login page")).toBeInTheDocument());
  });

  it("renders the outlet when already authenticated", async () => {
    store.dispatch(
      sessionEstablished({
        accessToken: "tk",
        user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isVerified: true },
      }),
    );
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<div>private</div>} />
            </Route>
            <Route path="/login" element={<div>login page</div>} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText("private")).toBeInTheDocument();
  });

  it("renders 403 when authenticated but role not allowed", async () => {
    store.dispatch(
      sessionEstablished({
        accessToken: "tk",
        user: { id: "u1", email: "a@b.com", name: "A", role: "EMPLOYEE", isVerified: true },
      }),
    );
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
              <Route path="/admin" element={<div>admin</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
    expect(screen.getByText(/403/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd Frontend && pnpm test src/features/auth/ProtectedRoute.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/features/auth/useBootstrapSession.ts Frontend/src/features/auth/ProtectedRoute.tsx Frontend/src/features/auth/ProtectedRoute.test.tsx
git commit -m "feat(frontend): ProtectedRoute + useBootstrapSession"
```

---

## Task 10: Brand Logo (preserved from existing JSX, ported to TSX)

**Files:**
- Create: `Frontend/src/components/brand/Logo.tsx`
- Create: `Frontend/src/components/brand/BrandText.tsx`

The branding strings come from the existing `Frontend/src/App.jsx` in the original commit. They are reproduced verbatim here so this plan is self-contained — `SMS-IP`, `Sehat - Meyer - Sejahtera` (with the trailing `"` corrected), `Indonesian professionals`, and the HSL gradient `from-[hsl(190,80%,55%)] to-[hsl(210,90%,50%)]`. Re-use `Frontend/public/logo.png` from the baseline commit.

- [ ] **Step 1: Restore `logo.png` from baseline**

```bash
git checkout 0cf620e -- Frontend/public/logo.png Frontend/public/favicon.ico Frontend/public/favicon-16x16.png Frontend/public/favicon-32x32.png Frontend/public/apple-touch-icon.png Frontend/public/android-chrome-192x192.png Frontend/public/android-chrome-512x512.png Frontend/public/site.webmanifest
mkdir -p Frontend/public
```

(Skip files that already exist after `rm -rf Frontend && mkdir Frontend` — we restore from the baseline tag/commit.)

- [ ] **Step 2: Create `Frontend/src/components/brand/BrandText.tsx`**

```tsx
import { cn } from "@/lib/utils";

interface Props {
  showTagline?: boolean;
  className?: string;
}

export function BrandText({ showTagline = true, className }: Props) {
  return (
    <div className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className="bg-gradient-to-r from-[hsl(190,80%,55%)] to-[hsl(210,90%,50%)] bg-clip-text text-base font-black tracking-wide text-transparent sm:text-2xl">
        SMS-IP
      </span>
      {showTagline && (
        <>
          <span className="hidden whitespace-nowrap text-[8px] font-semibold tracking-wider text-[hsl(190,70%,50%)] sm:block sm:text-[9px] md:text-[11px]">
            Sehat - Meyer - Sejahtera
          </span>
          <span className="hidden whitespace-nowrap text-[7px] font-medium tracking-wide text-[hsl(190,60%,45%)]/70 sm:block sm:text-[8px] md:text-[10px]">
            Indonesian professionals
          </span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `Frontend/src/components/brand/Logo.tsx`**

```tsx
import { Link } from "react-router-dom";
import { BrandText } from "./BrandText";
import { cn } from "@/lib/utils";

interface Props {
  isClickable?: boolean;
  showTagline?: boolean;
  className?: string;
}

function LogoMark({ showTagline, className }: Pick<Props, "showTagline" | "className">) {
  return (
    <div className={cn("flex items-center gap-1.5 sm:gap-3", className)}>
      <div className="relative h-9 w-9 shrink-0 sm:h-10 sm:w-10">
        <img src="/logo.png" alt="SMS-IP" className="h-full w-full object-contain" />
      </div>
      <BrandText showTagline={showTagline} />
    </div>
  );
}

export function Logo({ isClickable = false, showTagline = true, className }: Props) {
  if (isClickable) {
    return (
      <Link to="/" className="group flex min-w-0 shrink-0 items-center">
        <LogoMark showTagline={showTagline} className={className} />
      </Link>
    );
  }
  return <LogoMark showTagline={showTagline} className={className} />;
}
```

- [ ] **Step 4: Commit**

```bash
git add Frontend/public/ Frontend/src/components/brand/
git commit -m "feat(frontend): port SMS-IP Logo + BrandText to TSX"
```

---

## Task 11: AppLayout shell (Sidebar + Topbar)

**Files:**
- Create: `Frontend/src/components/layout/AppLayout.tsx`
- Create: `Frontend/src/components/layout/Sidebar.tsx`
- Create: `Frontend/src/components/layout/Topbar.tsx`
- Create: `Frontend/src/components/common/EmptyState.tsx`

- [ ] **Step 1: Create `Frontend/src/components/common/EmptyState.tsx`**

```tsx
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  hint?: string;
  className?: string;
}

export function EmptyState({ label, hint = "Coming soon.", className }: Props) {
  return (
    <div className={cn("flex h-full min-h-[40vh] flex-col items-center justify-center text-center", className)}>
      <div className="mb-2 text-2xl font-semibold tracking-tight">{label}</div>
      <div className="text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `Frontend/src/components/layout/Sidebar.tsx`**

```tsx
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  CalendarClock,
  Receipt,
  BadgeDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { Separator } from "@/components/ui/separator";

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", Icon: ListChecks },
  { to: "/messages", label: "Messages", Icon: MessageSquare },
  { to: "/attendance", label: "Attendance", Icon: CalendarClock },
  { to: "/expenses", label: "Expenses", Icon: Receipt },
  { to: "/payroll", label: "Payroll", Icon: BadgeDollarSign },
];

export function Sidebar() {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="px-4 py-5">
        <Logo isClickable showTagline={false} />
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 3: Create `Frontend/src/components/layout/Topbar.tsx`**

```tsx
import { LogOut, Moon, Sun, User } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { themeChanged } from "@/features/ui/uiSlice";
import { logoutThunk } from "@/features/auth/authThunks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Topbar() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const theme = useAppSelector((s) => s.ui.theme);
  const initials = user?.name
    ?.split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "??";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
      <div className="text-sm text-muted-foreground">
        {user ? `Welcome, ${user.name}` : ""}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => dispatch(themeChanged(theme === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">{user?.email}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-muted-foreground">
              {user?.role}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => dispatch(logoutThunk())}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `Frontend/src/components/layout/AppLayout.tsx`**

```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add Frontend/src/components/layout/ Frontend/src/components/common/
git commit -m "feat(frontend): AppLayout shell + Sidebar + Topbar + EmptyState"
```

---

## Task 12: LoginPage with form integration

**Files:**
- Create: `Frontend/src/features/auth/LoginPage.tsx`
- Create: `Frontend/src/features/auth/LoginPage.test.tsx`

- [ ] **Step 1: Create `Frontend/src/features/auth/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/brand/Logo";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { loginThunk } from "./authThunks";

export function LoginPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const action = await dispatch(loginThunk({ email, password }));
    setSubmitting(false);
    if (action.type.endsWith("/rejected")) {
      setError((action.payload as string) ?? "Login failed");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-4">
          <Logo showTagline />
          <div>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your SMS-IP workspace</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div role="alert" className="text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing LoginPage test**

Create `Frontend/src/features/auth/LoginPage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { authSlice } from "./authSlice";
import { uiSlice } from "@/features/ui/uiSlice";
import { setupApiClient, getApi } from "@/api/axios";
import { LoginPage } from "./LoginPage";

function buildStore() {
  const store = configureStore({ reducer: { auth: authSlice.reducer, ui: uiSlice.reducer } });
  setupApiClient(store, "http://api");
  return store;
}

let store: ReturnType<typeof buildStore>;
let mock: MockAdapter;

beforeEach(() => {
  store = buildStore();
  mock = new MockAdapter(getApi());
});

const renderPage = () =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );

describe("LoginPage", () => {
  it("renders email/password fields", () => {
    renderPage();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("on submit redirects to /dashboard on success", async () => {
    mock.onPost("/auth/login").reply(200, {
      accessToken: "tk",
      user: { id: "u1", email: "a@b.com", name: "A", role: "ADMIN", isVerified: true },
    });
    renderPage();
    await userEvent.type(screen.getByLabelText(/work email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pw");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("shows server error message on 401", async () => {
    mock.onPost("/auth/login").reply(401, { code: "UNAUTHORIZED", message: "Invalid credentials" });
    renderPage();
    await userEvent.type(screen.getByLabelText(/work email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid credentials/i);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
cd Frontend && pnpm test src/features/auth/LoginPage.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 4: Commit**

```bash
git add Frontend/src/features/auth/LoginPage.tsx Frontend/src/features/auth/LoginPage.test.tsx
git commit -m "feat(frontend): LoginPage with shadcn form + error display"
```

---

## Task 13: App.tsx — provider tree + router

**Files:**
- Modify: `Frontend/src/App.tsx`

- [ ] **Step 1: Replace `Frontend/src/App.tsx`**

```tsx
import { useEffect } from "react";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { store } from "@/app/store";
import { setupApiClient } from "@/api/axios";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/lib/theme";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { LoginPage } from "@/features/auth/LoginPage";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/common/EmptyState";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
setupApiClient(store, API_BASE);

function Routed() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<EmptyState label="Dashboard" />} />
          <Route path="/tasks" element={<EmptyState label="Tasks" />} />
          <Route path="/messages" element={<EmptyState label="Messages" />} />
          <Route path="/attendance" element={<EmptyState label="Attendance" />} />
          <Route path="/expenses" element={<EmptyState label="Expenses" />} />
          <Route path="/payroll" element={<EmptyState label="Payroll" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    document.title = "SMS-IP — Employee Management";
  }, []);
  return (
    <Provider store={store}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routed />
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </Provider>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd Frontend && pnpm exec tsc -b
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add Frontend/src/App.tsx
git commit -m "feat(frontend): App.tsx provider tree + router"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run all tests**

```bash
cd Frontend && pnpm test
```

Expected: every test from Tasks 3, 4, 5, 6, 8, 9, 12 passes (~25 tests).

- [ ] **Step 2: Type-check + production build**

```bash
cd Frontend && pnpm exec tsc -b && pnpm build
```

Expected: zero TS errors, `Frontend/dist/` produced.

- [ ] **Step 3: Manual smoke (requires backend up + seeded admin)**

```bash
# Terminal 1: docker mongo + backend
docker run --rm -d --name ems-mongo -p 27017:27017 mongo:7
cd Backend && pnpm seed && pnpm dev
# Terminal 2: orval generation (one-time)
cd Frontend && pnpm gen:api
# Terminal 3: frontend
cd Frontend && pnpm dev
```

Visit `http://localhost:5173`:
- Redirects to `/login`.
- Form submission with `admin@sms-ip.local` / `ChangeMe-Admin-1!` → AppLayout shell renders, sidebar visible at `lg+` breakpoint, Topbar with logo+welcome+theme-toggle+avatar-dropdown.
- Each sidebar link routes to its EmptyState.
- Theme toggle flips between dark/light immediately and persists across reload.
- Reload at `/dashboard` keeps the session (silent refresh).
- Logout returns to `/login`.

- [ ] **Step 4: Tag the milestone**

```bash
git tag foundation-frontend-done
```

---

## Definition of Done (Frontend Foundation)

- `pnpm install` resolves cleanly.
- `pnpm test` passes ~25 tests across slices, theme, axios, thunks, ProtectedRoute, LoginPage.
- `pnpm exec tsc -b` reports zero errors.
- `pnpm build` produces `Frontend/dist/`.
- With backend up + seed run + orval generated, the manual smoke flow above works end-to-end.
- Theme persists in localStorage; `<html class="dark">` syncs from Redux.
- Refresh-on-401 dedupes (verified in unit test).
- Refresh cookie is sent on `/auth/refresh` (visible in network tab; `withCredentials: true`).
- The git tag `foundation-frontend-done` exists.

After this plan completes, hand off to `2026-04-25-foundation-orchestration.md`.
