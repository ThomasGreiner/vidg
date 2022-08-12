import {EventEmitter} from "../events.js";

const emitter = new EventEmitter([
  "changes",
  "end",
  "error",
  "found",
  "process",
  "start"
]);
export default emitter;
