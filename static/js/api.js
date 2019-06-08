let postActions = new Set(["empty-trash"]);

async function dispatchEvent(resp) {
  let ev;
  if (resp.status === 200) {
    let data = await resp.json();
    ev = new CustomEvent("actionsuccess", {detail: data});
  } else {
    ev = new CustomEvent("actionerror");
  }
  document.dispatchEvent(ev);
}

async function del(endpoint) {
  await fetch(endpoint, {method: "DELETE"});
}

async function get(endpoint) {
  let resp = await fetch(endpoint);
  await dispatchEvent(resp);
}

async function patch(endpoint) {
  await fetch(endpoint, {method: "PATCH"});
}

async function post(endpoint) {
  await fetch(endpoint, {
    method: "POST",
    // TODO: NYI
    body: null
  });
}

async function put(endpoint, data) {
  await fetch(endpoint, {
    method: "PUT",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(data)
  });
}

export const api = {delete: del, get, patch, post, put};

export async function request(action, params = {}) {
  if (!action)
    return;
  
  let url = `/${action}`;
  let qs = new URLSearchParams();
  for (let name in params) {
    qs.append(name, params[name]);
  }
  
  let resp;
  if (postActions.has(action)) {
    resp = await fetch(url, {
      method: "POST",
      body: qs.toString()
    });
  } else {
    resp = await fetch(`${url}?${qs}`);
  }
  
  await dispatchEvent(resp);
}
