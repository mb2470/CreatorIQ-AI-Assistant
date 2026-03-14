# CreatorIQ AI Assistant

A React component library and standalone application for managing the creator lifecycle using Gemini AI. This assistant helps users discover creators, manage shortlists, generate one-sheets, brief creators, set payouts, and pull performance reports.

## Features

- **Discover Creators**: Find new creators based on niche and platform.
- **Search CRM**: Search for existing creators in your database.
- **Manage Lists**: Add creators to shortlists and generate one-sheets.
- **Campaign Management**: Add creators to campaigns, send briefs, and set payouts.
- **Content & Payments**: Review deliverables and approve payments.
- **Reporting**: Pull campaign performance metrics.

---

## 🚀 Deploying to Netlify

This application is fully configured to be deployed on Netlify out of the box.

### Steps to Deploy:

1. **Push to a Git Repository**:
   Push this entire codebase to a repository on GitHub, GitLab, or Bitbucket.

2. **Connect to Netlify**:
   - Log in to your [Netlify Dashboard](https://app.netlify.com/).
   - Click **"Add new site"** -> **"Import an existing project"**.
   - Connect your Git provider and select your repository.

3. **Configure Build Settings**:
   Netlify should automatically detect the settings from the included `netlify.toml` file. If not, verify the following:
   - **Base directory**: `(leave blank)`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

4. **Add Environment Variables**:
   - Click **"Add environment variables"**.
   - Add a new variable:
     - **Key**: `VITE_GEMINI_API_KEY` (or `GEMINI_API_KEY` depending on your Vite setup)
     - **Value**: `your_gemini_api_key_here`
   - *Note: The app uses `process.env.GEMINI_API_KEY` during the Vite build process to inject the key.*

5. **Deploy**:
   Click **"Deploy site"**. Netlify will build and host your application!

---

## 📦 Integrating into Other Applications

This repository is also configured as a reusable React component library. You can install it into other React applications and render the Assistant seamlessly without the standalone app's branding.

### 1. Installation

**Important Note for AI Studio Environments:**
If you are trying to install this package inside another Google AI Studio environment, **all outbound connections to GitHub are blocked by the environment's proxy** (resulting in 403 errors for both `git+https` and `tarball` URLs). 

To use this component in another AI Studio app, you must use one of these two methods:

**Method A: Publish to NPM (Recommended for package usage)**
1. Clone this repository to your local machine.
2. Run `npm install` and `npm run build:lib`.
3. Run `npm login` and `npm publish` to publish it to the public NPM registry.
4. In your other AI Studio app, run `npm install your-published-package-name`.

**Method B: Direct Copy (Fastest for AI Studio)**
Since the assistant is largely self-contained, you can simply ask the AI in your other project to:
1. Create a file named `src/components/CreatorIQAssistant.tsx`.
2. Copy the contents of this repository's `CreatorIQAssistant.tsx` into it.
3. Install the required dependencies: `npm install @google/genai react-markdown lucide-react`.

**Standard Installation (For local development or standard CI/CD):**
```bash
npm install git+https://github.com/your-username/your-repo-name.git
```

### 2. Usage

Import the `CreatorIQAssistant` component and render it anywhere in your app. It is unbranded and will expand to fill its parent container.

```tsx
import React from 'react';
import { CreatorIQAssistant } from 'your-repo-name'; // Replace with your package name

function Dashboard() {
  return (
    <div className="dashboard-layout">
      {/* Your app's navigation and branding goes here */}
      <nav>My App Navigation</nav>
      
      {/* The Assistant Component */}
      <div className="h-[600px] w-full max-w-3xl rounded-xl overflow-hidden shadow-lg border border-gray-200">
        <CreatorIQAssistant apiKey="YOUR_GEMINI_API_KEY" />
      </div>
    </div>
  );
}

export default Dashboard;
```

### 3. Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiKey` | `string` | No* | Your Gemini API key. *If not provided, it will attempt to use the environment variable `GEMINI_API_KEY` injected at build time.* |
| `className` | `string` | No | Additional Tailwind classes or CSS classes to apply to the root container. |

## Development

To run the standalone app locally:

```bash
npm install
npm run dev
```

To build the library package locally:

```bash
npm run build:lib
```
