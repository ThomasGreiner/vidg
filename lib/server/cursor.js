"use strict";

class Cursor {
  constructor(list) {
    this._baseList = list;
    this._list = list;
    this._current = 0;
  }
  
  get current() {
    return this._list[this._current];
  }
  
  each(onEach) {
    for (let item of this._list) {
      onEach(item);
    }
  }
  
  filter(fn, resetBaseList) {
    if (fn) {
      this._list = this._baseList.filter(fn);
      if (resetBaseList) {
        this._baseList = this._list;
      }
    } else {
      this._list = this._baseList;
    }
    
    this._current = 0;
  }
  
  hasNext() {
    return this._current + 1 < this._list.length;
  }
  
  hasPrevious() {
    return this._current > 0;
  }
  
  next(selector) {
    if (this.hasNext()) {
      this._current++;
      
      if (selector && "rated" in selector && !selector.rated) {
        for (let i = this._current; i < this._list.length; i++) {
          if (this._list[i].rating === 0) {
            this._current = i;
            break;
          }
        }
      }
    }
    return this.current;
  }
  
  previous(selector) {
    if (this.hasPrevious()) {
      this._current--;
      
      if (selector && "rated" in selector && !selector.rated) {
        for (let i = this._current; i > -1; i--) {
          if (this._list[i].rating === 0) {
            this._current = i;
            break;
          }
        }
      }
    }
    return this.current;
  }
  
  sort(fn) {
    this._list.sort(fn);
    this._current = 0;
  }
}

module.exports = Cursor;
