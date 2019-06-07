let postActions = new Set(["empty-trash", "rate-down", "rate-up", "view",
    "view-all"]);

function dispatchEvent(status, data) {
  let name = (status === 200) ? "actionsuccess" : "actionerror";
  document.dispatchEvent(new CustomEvent(name, {detail: data}));
}

async function get(endpoint) {
  let resp = await fetch(endpoint);
  let data = await resp.json();
  dispatchEvent(resp.status, data);
}

async function post(endpoint) {
  await fetch(endpoint, {
    method: "POST",
    body: null
  });
}

export const api = {get, post};

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
  
  let data;
  try {
    data = await resp.json();
  }
  catch (ex) {
    // Response contains no data
  }
  dispatchEvent(resp.status, data);
}
