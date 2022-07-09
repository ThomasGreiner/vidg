import api from "./api.js";
import {$} from "./common.js";

let player = $("#player");

export function setPlayer(id, poster) {
  player.poster = poster;
  player.src = `/file?id=${id}&type=video`;
}

player.addEventListener("ended", () => {
  document.webkitExitFullscreen();
  location.reload();
});

player.addEventListener("error", () => {
  document.webkitExitFullscreen();
});

export let keyMap = {
  "ArrowDown": async () => {
    await api.patch("/file/rating?dir=down");
    await api.get("/file");
  },
  "Enter": () => {
    if (player.paused) {
      document.body.requestFullscreen();
      player.play();
    } else {
      document.exitFullscreen();
      api.get("/file");
    }
  },
  "ArrowLeft": () => {
    if (player.paused) {
      api.get("/file?dir=prev");
    } else {
      player.currentTime -= 60;
    }
  },
  "ArrowRight": () => {
    if (player.paused) {
      api.get("/file?dir=next");
    } else {
      player.currentTime += 60;
    }
  },
  "ArrowUp": async () => {
    await api.patch("/file/rating?dir=up");
    await api.get("/file");
  },
  "n": async () => {
    if (!document.fullscreenElement)
      return
    
    await api.get("/file?dir=next");
    player.play();
  },
  "p": async () => {
    if (!document.fullscreenElement)
      return;
    
    await api.get("/file?dir=prev");
    player.play();
  },
  " ": () => {
    if (player.paused) {
      player.play();
    } else {
      player.pause();
    }
  },
  "CTRL+ArrowLeft": () => {
    if (player.paused) {
      api.get("/file?dir=prev&unrated=true");
    } else {
      player.currentTime -= 10;
    }
  },
  "CTRL+ArrowRight": () => {
    if (player.paused) {
      api.get("/file?dir=next&unrated=true");
    } else {
      player.currentTime += 10;
    }
  },
  "CTRL+Enter": () => {
    api.post("/file/open");
  },
  "SHIFT+ArrowLeft": () => {
    if (!player.paused) {
      player.currentTime -= 3;
    }
  },
  "SHIFT+ArrowRight": () => {
    if (!player.paused) {
      player.currentTime += 3;
    }
  }
};
