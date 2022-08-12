import {setShortcut} from "./shortcuts.js";
import * as api from "../storage/api.js";
import {$} from "./utils.js";

const player = $("#player");

let isPlayback = false;

async function attemptPlay() {
  try {
    await player.play();
  } catch(ex) {
    console.error(ex);
    player.pause();
  }
}

// TODO: remove after fixing embedded player's size changing after playing
function resetPlayer() {
  /* eslint-disable-next-line no-self-assign */
  player.src = player.src;
}

function setPlayback(value) {
  if (value) {
    document.body.requestFullscreen();
    attemptPlay();
  } else {
    document.exitFullscreen();
    resetPlayer();
  }
  isPlayback = value;
}

export async function setPlayer(id, poster) {
  player.poster = poster;
  // TODO: load video without web server
  player.src = `http://localhost:8080/file?id=${id}&type=video`;
  
  if (isPlayback) {
    await attemptPlay();
  }
}

player.addEventListener("error", (err) => {
  console.error(err);
  player.pause();
});

/*******************************************************************************
 * Playback
 ******************************************************************************/

setShortcut(null, "CTRL+Enter", () => {
  api.files.open();
});

setShortcut(null, "Enter", async () => {
  if (player.paused) {
    setPlayback(true);
  } else {
    setPlayback(false);
  }
});

setShortcut(null, "Escape", () => {
  setPlayback(false);
});

player.addEventListener("ended", async () => {
  if (!isPlayback)
    return;
  
  api.files.next();
});

setShortcut(null, " ", () => {
  if (player.paused) {
    attemptPlay(player);
  } else {
    player.pause();
  }
});

setShortcut(null, "n", async () => {
  if (!isPlayback)
    return;
  
  api.files.next();
});

setShortcut(null, "p", async () => {
  if (!isPlayback)
    return;
  
  api.files.previous();
});


/*******************************************************************************
 * Seeking
 ******************************************************************************/

setShortcut("file.next", "ArrowRight", () => {
  if (player.paused) {
    api.files.next();
    setPlayback(false);
  }
  
  player.currentTime += 60;
});
setShortcut("file.prev", "ArrowLeft", () => {
  if (player.paused) {
    api.files.previous();
    setPlayback(false);
    return;
  }
  
  player.currentTime -= 60;
});

setShortcut(null, "CTRL+ArrowLeft", () => {
  if (player.paused)
    return;
  
  player.currentTime -= 10;
});
setShortcut(null, "CTRL+ArrowRight", () => {
  if (player.paused)
    return;
  
  player.currentTime += 10;
});

setShortcut(null, "SHIFT+ArrowLeft", () => {
  if (player.paused)
    return;
  
  player.currentTime -= 3;
});
setShortcut(null, "SHIFT+ArrowRight", () => {
  if (player.paused)
    return;
  
  player.currentTime += 3;
});
