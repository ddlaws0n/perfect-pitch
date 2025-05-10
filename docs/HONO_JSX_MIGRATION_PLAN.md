# Hono JSX Frontend Migration Plan for Perfect Pitch

## 1. Introduction and Goals

This document outlines the plan to migrate the current simple HTML/Tailwind frontend of the 'Perfect Pitch' AI interview platform to Hono JSX. The primary goals of this migration are:

- **Improved Developer Experience**: Leverage JSX for building UI components, leading to more organized and maintainable code.
- **Type Safety**: Utilize TypeScript with JSX to catch errors during development.
- **Component Reusability**: Create reusable UI components for common elements across the application.
- **Server-Side Rendering (SSR) Potential**: Hono JSX allows for server-side rendering, which can improve initial page load times and SEO, although the initial focus will be on client-side rendering (CSR) with potential for SSR exploration later.
- **Seamless Integration**: Maintain tight integration with the existing Hono backend running on Cloudflare Workers.

## 2. Research: Hono JSX and Best Practices

(MCP Research step was skipped due to tool limitations in the current mode. This section is based on general knowledge of Hono, JSX, and Cloudflare Workers.)

### 2.1. Hono JSX Overview

Hono's JSX middleware (`hono/jsx`) allows developers to use JSX syntax to define HTML structures within their Hono applications. It's lightweight and designed to work efficiently within serverless environments like Cloudflare Workers.

Key features relevant to this migration:

- **Familiar Syntax**: JSX is widely adopted and familiar to developers working with libraries like React.
- **Component-Based Architecture**: Encourages breaking down the UI into smaller, manageable components.
- **No Virtual DOM by Default (for basic SSR)**: When used for SSR, Hono JSX typically renders directly to strings, avoiding the overhead of a virtual DOM, making it fast. For client-side interactivity, a separate lightweight library or custom JavaScript will be needed.
- **TypeScript Support**: JSX works well with TypeScript, providing type checking for component props and state.

### 2.2. Benefits in Cloudflare Workers Environment

- **Performance**: Hono is known for its speed, and its JSX middleware is designed to be efficient.
- **Simplified Build Process**: Compared to heavier frontend frameworks, integrating Hono JSX can lead to a simpler build setup, especially when primarily targeting SSR or simple client-side enhancements.
- **Unified Framework**: Using Hono for both backend routing and frontend templating can streamline development.

### 2.3. Best Practices for Structuring

- **Component-Based Structure**:
  - Organize UI elements into reusable components (e.g., `Layout`, `Button`, `Modal`, `InterviewCard`).
  - Create a `src/frontend/components/` directory.
- **Page Components**:
  - Each existing HTML page ([`auth.html`](./public/auth.html), [`dashboard.html`](./public/dashboard.html), [`interview.html`](./public/interview.html)) will become a top-level "page" component.
  - Create a `src/frontend/pages/` directory.
- **Layouts**:
  - Define a main layout component (`src/frontend/layouts/MainLayout.tsx`) that includes common elements like headers, footers, and navigation.
- **Static Assets**:
  - Continue serving static assets (CSS, client-side JS bundles, images) from the `/public` directory or a dedicated `/static` route managed by Hono.
- **Routing**:
  - Hono routes will render these JSX page components.

## 3. Architectural Approach

### 3.1. Converting HTML Files to Hono JSX Components

The existing HTML files will be broken down and rebuilt as Hono JSX components.

- **Directory Structure Proposal**:

  ```
  src/
  ├── frontend/
  │   ├── components/       # Reusable UI components (e.g., Button.tsx, Modal.tsx, ChatMessage.tsx)
  │   │   └── common/
  │   │   └── auth/
  │   │   └── dashboard/
  │   │   └── interview/
  │   ├── layouts/          # Layout components (e.g., MainLayout.tsx)
  │   ├── pages/            # Page-level components (e.g., AuthPage.tsx, DashboardPage.tsx, InterviewPage.tsx)
  │   └── island_components/ # Components requiring client-side hydration (if adopting an islands architecture)
  │   └── client-js/        # Dedicated client-side JavaScript modules
  ├── index.ts              # Main worker
  ├── routes/
  │   ├── auth.ts
  │   ├── interview.ts
  │   └── ui.ts             # New: Routes for serving Hono JSX pages
  ... (other backend files)
  public/
  ├── styles.css            # Compiled Tailwind CSS
  ├── images/
  ... (other static assets)
  ```

- **[`public/auth.html`](./public/auth.html) -> `src/frontend/pages/AuthPage.tsx`**:
  - Will contain the login form.
  - Client-side JS for form submission will be linked or inlined.
- **[`public/dashboard.html`](./public/dashboard.html) -> `src/frontend/pages/DashboardPage.tsx`**:
  - Will display the list of interviews.
  - Client-side JS for fetching and displaying interviews, and initiating new interviews.
- **[`public/interview.html`](./public/interview.html) -> `src/frontend/pages/InterviewPage.tsx`**:
  - Will contain the interview interface (chat display, audio controls).
  - Significant client-side JavaScript for WebSocket communication, audio handling, and real-time UI updates will be refactored and linked.

### 3.2. Tailwind CSS Integration

Tailwind CSS will continue to be used for styling.

- **Compilation**: The Tailwind CSS build process will remain largely the same, outputting a `styles.css` file (e.g., `public/styles.css`).
- **Linking**: This compiled CSS file will be linked in the main layout component (`MainLayout.tsx`) within the `<head>` tag.
  ```tsx
  // src/frontend/layouts/MainLayout.tsx
  export const MainLayout = (props: { title: string; children?: any }) => (
    <html>
      <head>
        <title>{props.title} | Perfect Pitch</title>
        <link rel="stylesheet" href="/styles.css" />
        {/* Potentially add a script tag for global client-side JS */}
      </head>
      <body>
        {/* Header/Nav component could go here */}
        <main class="container mx-auto p-4">{props.children}</main>
        {/* Footer component could go here */}
      </body>
    </html>
  )
  ```
- **JSX Class Names**: Tailwind classes will be applied directly in the JSX components.

### 3.3. Client-Side Interactivity

Hono JSX itself is primarily for rendering HTML. Client-side interactivity will be handled by:

- **Dedicated JavaScript Modules**:
  - Existing client-side JavaScript logic from `auth.html`, `dashboard.html`, and `interview.html` will be refactored into modules (e.g., `src/frontend/client-js/auth.js`, `src/frontend/client-js/interviewWebSocket.js`).
  - These modules will be bundled (e.g., using esbuild or a simple script in `justfile`) and served as static assets.
  - They will be included via `<script>` tags in the respective page components or the main layout.
- **Event Listeners**: Standard `addEventListener` will be used to attach behavior to DOM elements.
- **Islands Architecture (Optional Future Enhancement)**: For more complex components requiring significant client-side hydration, an "islands" approach could be considered. This involves rendering static HTML on the server and "hydrating" specific components on the client-side with JavaScript. Libraries like Preact or SolidJS could be used for these islands if needed, but the initial approach will be vanilla JS.

## 4. Implementation Steps

### 4.1. Setup Hono JSX

1.  **Install Dependencies**:
    - Add `hono` (if not already fully utilized for JSX) and potentially a JSX runtime if Hono's built-in one isn't sufficient for client-side needs (though for SSR/simple CSR it should be).
2.  **Configure `tsconfig.json`**:
    Ensure JSX settings are correctly configured:
    ```json
    {
      "compilerOptions": {
        // ... other options
        "jsx": "react-jsx", // or "preserve" if using a separate build step for JSX
        "jsxImportSource": "hono/jsx"
      }
    }
    ```
3.  **Update Build Process (if necessary)**:
    - If using `jsx: "preserve"`, ensure the build process (e.g., esbuild via `justfile`) transpiles JSX.
    - Modify `justfile` to bundle client-side JavaScript modules.

### 4.2. Create Core Layout and Common Components

1.  **`MainLayout.tsx`**:
    - Define the basic HTML structure (head, body), link to Tailwind CSS.
    - Include placeholders for header, navigation, and footer.
2.  **Common Components** (`src/frontend/components/common/`):
    - `Button.tsx`, `Input.tsx`, `Card.tsx`, etc.

### 4.3. Convert Pages (Iterative Approach)

Start with the simplest page and iterate.

1.  **Auth Page (`AuthPage.tsx`)**:
    - Create the JSX structure based on [`public/auth.html`](./public/auth.html).
    - Refactor `auth.html`'s JavaScript into `src/frontend/client-js/auth.ts` (or similar).
    - Bundle `auth.ts` and link it in `AuthPage.tsx`.
    - Create a Hono route in `src/routes/ui.ts` to render `AuthPage.tsx`.
2.  **Dashboard Page (`DashboardPage.tsx`)**:
    - Create JSX structure based on [`public/dashboard.html`](./public/dashboard.html).
    - Refactor its JavaScript for fetching/displaying interviews.
    - Create Hono route.
3.  **Interview Page (`InterviewPage.tsx`)**:
    - This is the most complex page.
    - Break down the UI into smaller components (e.g., `ChatMessage.tsx`, `AudioRecorder.tsx`).
    - Carefully refactor the WebSocket and audio handling JavaScript into `src/frontend/client-js/interview.ts` (or multiple modules).
    - Create Hono route.

### 4.4. Update Hono Routing

1.  **Create `src/routes/ui.ts`**:

    ```typescript
    // src/routes/ui.ts
    import { Hono } from 'hono';
    import { jsxRenderer } from 'hono/jsx-renderer';
    import { MainLayout } from '../frontend/layouts/MainLayout';
    import { AuthPage } from '../frontend/pages/AuthPage';
    import { DashboardPage }_from '../frontend/pages/DashboardPage'; // Corrected import
    import { InterviewPage } from '../frontend/pages/InterviewPage';

    const app = new Hono();

    // Setup JSX renderer with default layout
    app.get(
      '*',
      jsxRenderer(
        ({ children, title }) => <MainLayout title={title}>{children}</MainLayout>
      )
    );

    app.get('/auth', (c) => {
      return c.render(<AuthPage />, { title: 'Login' });
    });

    app.get('/dashboard', (c) => {
      // Props might be needed here, e.g., list of interviews
      return c.render(<DashboardPage />, { title: 'Dashboard' });
    });

    app.get('/interview/:id', (c) => {
      const interviewId = c.req.param('id');
      // Props for interview data
      return c.render(<InterviewPage interviewId={interviewId} />, { title: 'Interview' });
    });

    // Potentially serve client-side JS bundles from here or via static middleware
    // app.get('/static/js/:filename', async (c) => { ... });


    export default app;
    ```

2.  **Integrate `ui.ts` into `src/index.ts`**:

    ```typescript
    // src/index.ts
    // ... other imports
    import uiApp from './routes/ui'

    // ...
    app.route('/ui', uiApp) // Or directly app.route('/', uiApp) if these are the primary frontend routes
    // ...
    ```

3.  **Update `wrangler.jsonc`**:
    - Ensure routes point to the new Hono JSX endpoints instead of serving static HTML files directly for these pages. The static asset serving for CSS/JS bundles will still be important.
    - The `[[sites]]` configuration in `wrangler.toml` (or `wrangler.jsonc`) might need adjustment if it was previously serving the HTML files from `public` directly for these routes. Now, Hono will handle these routes and render JSX. The `public` directory will primarily serve CSS, images, and bundled JS.

### 4.5. Client-Side JavaScript Bundling

- Use a simple bundler like `esbuild` (can be invoked via `justfile`).
- **Example `justfile` task**:
  ```just
  # justfile
  build-client-js:
      esbuild src/frontend/client-js/auth.ts --bundle --outfile=public/js/auth.bundle.js --minify
      esbuild src/frontend/client-js/dashboard.ts --bundle --outfile=public/js/dashboard.bundle.js --minify
      esbuild src/frontend/client-js/interview.ts --bundle --outfile=public/js/interview.bundle.js --minify
  ```
- These bundled files would then be linked in the respective JSX page components.

## 5. User Experience (UX) Considerations

- **Maintain Functionality**: All existing features must work as before.
- **Performance**:
  - Aim for similar or better page load times. SSR capabilities of Hono JSX could be explored later for optimization.
  - Ensure client-side JavaScript is optimized and bundled efficiently.
- **Visual Consistency**: Tailwind CSS ensures visual style remains consistent.
- **Progressive Enhancement**: If feasible, ensure core content is accessible even if JavaScript fails (more relevant if moving towards SSR).
- **Error Handling**: Implement clear error messages and states in the UI, both from server-rendered parts and client-side interactions.

## 6. Potential Challenges

- **Learning Curve**: While JSX is common, integrating it specifically with Hono in a Cloudflare Workers context might have nuances.
- **Build Process Adjustments**: The `justfile` and potentially `wrangler.jsonc` will need updates for JSX transpilation (if not handled by `hono/jsx-renderer`'s default behavior with `esbuild` directly) and client-side JS bundling.
- **Client-Side State Management**: For `interview.html`, managing real-time state (messages, audio status) on the client-side will remain complex. The migration won't inherently simplify this but aims to structure the rendering part more cleanly.
- **Debugging**: Debugging issues that span server-rendered JSX and client-side JavaScript might require careful attention.
- **TypeScript Complexity**: Ensuring proper typing for components, props, and client-side interactions can add initial overhead but pays off in maintainability.
- **Hydration (if moving to Islands)**: If complex client-side components necessitate an islands architecture, choosing and integrating a suitable lightweight library (e.g., Preact, SolidJS) would add another layer of complexity. The initial plan is to stick with vanilla JS for client-side logic.

## 7. Next Steps

1.  Set up the basic Hono JSX project structure and `tsconfig.json` adjustments.
2.  Implement the `MainLayout.tsx` component.
3.  Begin converting the `AuthPage` as a pilot.
4.  Develop client-side JS bundling strategy using `justfile` and `esbuild`.
5.  Iteratively convert `DashboardPage` and `InterviewPage`.
6.  Thoroughly test each page and component.
