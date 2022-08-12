export class EventEmitter {
  constructor(names) {
    this._listeners = new Map(names.map((name) => [name, new Set()]));
  }
  
  emit(name, data) {
    const listeners = this._listeners.get(name);
    if (!listeners)
      return;
    
    for (const listener of listeners) {
      listener(data);
    }
  }
  
  on(name, listener) {
    const listeners = this._listeners.get(name);
    if (!name)
      return;
    
    listeners.add(listener);
  }
}
