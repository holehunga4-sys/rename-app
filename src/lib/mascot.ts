export type MascotState = 'idle' | 'click' | 'loading' | 'success' | 'error' | 'spam';

export const triggerMascot = (state: MascotState) => {
  window.dispatchEvent(new CustomEvent('mascot-action', { detail: state }));
};
