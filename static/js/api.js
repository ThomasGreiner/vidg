let postActions = new Set(["empty-trash", "rate-down", "rate-up", "view",
    "view-all"]);

function dispatchEvent(name, data) {
  document.dispatchEvent(new CustomEvent(name, {detail: data}));
}

async function get(endpoint) {
  let resp = await fetch(endpoint);
  let data = await resp.json();
  dispatchEvent(
    (resp.status === 200) ? "actionsuccess" : "actionerror",
    data
  );
}

export const api = {get};

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
  
  let evName = (resp.status === 200) ? "actionsuccess" : "actionerror";
  let data;
  try {
    data = await resp.json();
  }
  catch (ex) {
    // Response contains no data
  }
  dispatchEvent(evName, data);
}
