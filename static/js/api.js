async function del(endpoint) {
  await fetch(endpoint, {method: "DELETE"});
}

async function get(endpoint) {
  let resp = await fetch(endpoint);
  
  let ev;
  if (resp.status === 200) {
    let data = await resp.json();
    ev = new CustomEvent("filedata", {detail: data});
  } else {
    ev = new CustomEvent("fileerror");
  }
  document.dispatchEvent(ev);
}

async function patch(endpoint) {
  await fetch(endpoint, {method: "PATCH"});
}

async function post(endpoint) {
  await fetch(endpoint, {method: "POST"});
}

async function put(endpoint, data) {
  await fetch(endpoint, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(data)
  });
}

export default {
  delete: del,
  get, patch, post, put
};
