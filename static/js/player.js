import {api, request} from "./api.js";
import {$, registerActions} from "./common.js";

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

registerActions({
  "ArrowDown": "rate-down",
  "Enter": () => {
    if (player.paused) {
      player.webkitRequestFullscreen();
      player.play();
    } else {
      document.webkitExitFullscreen();
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
  "ArrowUp": () => request("rate-up"),
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
});
