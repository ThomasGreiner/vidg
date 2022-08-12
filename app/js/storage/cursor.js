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
  
  next() {
    if (this.hasNext()) {
      this._current++;
    }
    return this.current;
  }
  
  previous() {
    if (this.hasPrevious()) {
      this._current--;
    }
    return this.current;
  }
  
  sort(fn) {
    this._list.sort(fn);
    this._current = 0;
  }
}

function calcSizes() {
  const ratings = Object.create(null);
  let totalSize = 0;
  
  for (const entry of this._list) {
    const size = (entry.a || entry).stats.size;
    const rating = (entry.a || entry).rating;
    if (!(rating in ratings)) {
      ratings[rating] = {count: 0, size: 0};
    }
    ratings[rating].count++;
    ratings[rating].size += size;
    totalSize += size;
  }
  
  this._ratings = ratings;
  this._size = totalSize;
}

export class FileCursor extends Cursor {
  get ratings() {
    calcSizes.call(this);
    return this._ratings;
  }
  
  get size() {
    calcSizes.call(this);
    return this._size;
  }
}
