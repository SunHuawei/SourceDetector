declare global {
  interface Window {
    demo: {
      on: (channel: string, func: (...args: any[]) => void) => void;
    };
  }
}

window.demo.on('main-process-message', (...args) => {
  console.log('[Receive Main-process message]:', ...args)
})

export {}
