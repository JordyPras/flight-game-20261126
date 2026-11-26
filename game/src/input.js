// Langit Nusantara — Island Courier: keyboard, mouse and touch input.
// The game is steered three ways: arrow keys / WASD, the mouse (point where to
// fly), and touch (drag to steer, on-screen throttle buttons). All three feed
// one small shape: { pitch, bank, throttle, brake, confirm, restart, pause }.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseX = null;
    this.mouseY = null;
    this.mouseActive = false;
    this.touchX = null;
    this.touchY = null;
    this.touchActive = false;
    this.touchThrottle = 0;
    this.confirmPressed = false;
    this.restartPressed = false;
    this.pausePressed = false;
    this.mutePressed = false;
    this.attached = false;
  }

  attach() {
    if (this.attached) return;
    this.attached = true;
    const canvas = this.canvas;
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.key)) {
        event.preventDefault();
      }
      if (event.repeat) return;
      this.keys.add(event.key.toLowerCase());
      if (event.key === 'Enter' || event.key === ' ') this.confirmPressed = true;
      if (event.key.toLowerCase() === 'r') this.restartPressed = true;
      if (event.key.toLowerCase() === 'p' || event.key === 'Escape') this.pausePressed = true;
      if (event.key.toLowerCase() === 'm') this.mutePressed = true;
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseActive = false;
      this.touchActive = false;
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
      this.mouseActive = true;
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouseActive = false;
    });
    canvas.addEventListener('mousedown', () => {
      this.confirmPressed = true;
    });
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      this.touchX = touch.clientX - rect.left;
      this.touchY = touch.clientY - rect.top;
      this.touchActive = true;
      this.confirmPressed = true;
    }, { passive: false });
    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      this.touchX = touch.clientX - rect.left;
      this.touchY = touch.clientY - rect.top;
    }, { passive: false });
    canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      this.touchActive = false;
      this.touchThrottle = 0;
    }, { passive: false });
  }

  /** True while a key is held down. */
  held(...names) {
    return names.some((name) => this.keys.has(name));
  }

  /**
   * Read the current steering. `width` and `height` are the canvas CSS size, so
   * mouse and touch positions map to the same -1..1 stick range as the keys.
   */
  read(width, height) {
    let pitch = 0;
    let bank = 0;
    let throttle = 0;
    if (this.held('arrowup', 'w')) pitch += 1;
    if (this.held('arrowdown', 's')) pitch -= 1;
    if (this.held('arrowleft', 'a')) bank -= 1;
    if (this.held('arrowright', 'd')) bank += 1;
    if (this.held('shift')) throttle += 1;
    if (this.held('control', 'c')) throttle -= 1;
    // Mouse steering: point at the sky and the plane follows, gently.
    if (this.mouseActive && this.mouseX !== null && !this.held('arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd')) {
      const nx = (this.mouseX / width) * 2 - 1;
      const ny = (this.mouseY / height) * 2 - 1;
      bank = Math.max(-1, Math.min(1, nx * 1.4));
      pitch = Math.max(-1, Math.min(1, -ny * 1.2));
    }
    // Touch steering: drag from where the finger landed.
    if (this.touchActive && this.touchX !== null) {
      const nx = (this.touchX / width) * 2 - 1;
      const ny = (this.touchY / height) * 2 - 1;
      bank = Math.max(-1, Math.min(1, nx * 1.4));
      pitch = Math.max(-1, Math.min(1, -ny * 1.2));
      throttle += this.touchThrottle;
    }
    const brake = this.held('b') || this.held(' ');
    return { pitch, bank, throttle, brake };
  }

  /** One-shot flags, cleared by the caller after reading. */
  takeConfirm() {
    const value = this.confirmPressed;
    this.confirmPressed = false;
    return value;
  }

  takeRestart() {
    const value = this.restartPressed;
    this.restartPressed = false;
    return value;
  }

  takePause() {
    const value = this.pausePressed;
    this.pausePressed = false;
    return value;
  }

  takeMute() {
    const value = this.mutePressed;
    this.mutePressed = false;
    return value;
  }
}
