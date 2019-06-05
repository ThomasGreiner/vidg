import {request} from "./api.js";
import {$, registerActions} from "./common.js";

let player = $("#player");

export function setPlayer(id, poster) {
  player.poster = poster;
  player.src = `/video?id=${id}`;
}

player.addEventListener("ended", () => {
  document.webkitExitFullscreen();
  location.reload();
});

player.addEventListener("error", () => {
  document.webkitExitFullscreen();
});

registerActions("current", {
  "ArrowDown": "rate-down",
  "Enter": () => {
    if (player.paused) {
      player.webkitRequestFullscreen();
      player.play();
    } else {
      document.webkitExitFullscreen();
      request("current");
    }
  },
  "ArrowLeft": () => {
    if (player.paused) {
      request("prev");
    } else {
      player.currentTime -= 60;
    }
  },
  "ArrowRight": () => {
    if (player.paused) {
      request("next");
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
      request("prev-unrated");
    } else {
      player.currentTime -= 10;
    }
  },
  "CTRL+ArrowRight": () => {
    if (player.paused) {
      request("next-unrated");
    } else {
      player.currentTime += 10;
    }
  },
  "CTRL+Enter": "view",
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
