import DefaultTheme from 'vitepress/theme';
import { h, nextTick, onMounted, watch } from 'vue';
import { useRoute } from 'vitepress';
import './style.css';

declare global {
  interface Window {
    mermaid?: {
      initialize: (options: Record<string, unknown>) => void;
      run: (options: { nodes: Element[] }) => Promise<void>;
    };
  }
}

let mermaidLoad: Promise<void> | undefined;

function loadMermaid(): Promise<void> {
  if (window.mermaid) {
    return Promise.resolve();
  }
  if (!mermaidLoad) {
    mermaidLoad = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load Mermaid renderer.`));
      document.head.appendChild(script);
    });
  }
  return mermaidLoad;
}

async function renderMermaid(): Promise<void> {
  const nodes = Array.from(document.querySelectorAll('.mermaid:not([data-processed="true"])'));
  if (nodes.length === 0) {
    return;
  }
  await loadMermaid();
  window.mermaid?.initialize({
    startOnLoad: false,
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
  });
  await window.mermaid?.run({ nodes });
}

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute();
    const scheduleRender = () => {
      void nextTick().then(renderMermaid);
    };
    onMounted(scheduleRender);
    watch(() => route.path, scheduleRender);
  },
  Layout() {
    return h(DefaultTheme.Layout);
  },
};
