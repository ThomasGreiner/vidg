const colors = ["#D88", "#FFF", "#DED", "#CDC", "#ADA", "#8D8", "#6D6"];
const statsWidth = 2000;
const statsHeight = 20;

class Canvas {
  constructor(width, height) {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    return element;
  }
}

export function getStatusCharts(cursor) {
  let cStatus = new Canvas(statsWidth, statsHeight);
  let ctxStatus = cStatus.getContext("2d");
  let byteWidth = statsWidth / cursor.size;
  let x = 0;
  let current = null;
  
  let cDist = new Canvas(100, 100);
  let ctxDist = cDist.getContext("2d");
  let dist = [0, 0, 0, 0, 0, 0, 0];
  
  cursor.each((entry) => {
    entry = entry.a || entry;
    let width = byteWidth * entry.stats.size;
    if (entry.id === cursor.current.id) {
      current = current || {x, width};
    }
    ctxStatus.fillStyle = colors[entry.rating + 1];
    ctxStatus.fillRect(Math.round(x), 0, Math.ceil(width), statsHeight);
    x += width;
    
    dist[entry.rating + 1] += entry.stats.size;
  });
  
  // ensure that slice for current file is always shown
  ctxStatus.fillStyle = "#FE5";
  ctxStatus.fillRect(Math.round(current.x), 0, Math.ceil(current.width), statsHeight);
  
  // draw pointer for current file
  x = current.x + current.width / 2;
  ctxStatus.fillStyle = "#EEE";
  ctxStatus.strokeStyle = "#888";
  ctxStatus.beginPath();
  ctxStatus.moveTo(x - statsHeight / 4, statsHeight);
  ctxStatus.lineTo(x, statsHeight / 2);
  ctxStatus.lineTo(x + statsHeight / 4, statsHeight);
  ctxStatus.fill();
  ctxStatus.stroke();
  
  // draw distribution pie chart
  let prevRad = -Math.PI / 2;
  let center = {x: cDist.width / 2, y: cDist.height / 2};
  for (let i = dist.length; i--;) {
    let rad = Math.PI * 2 * (dist[i] / cursor.size);
    ctxDist.fillStyle = colors[i];
    ctxDist.beginPath();
    ctxDist.moveTo(center.x, center.y);
    ctxDist.arc(center.x, center.y, center.y, prevRad, prevRad + rad, false);
    ctxDist.lineTo(center.x, center.y);
    ctxDist.fill();
    prevRad += rad;
  }
  
  return {
    distribution: cDist.toDataURL("image/png"),
    status: cStatus.toDataURL("image/png")
  };
}
