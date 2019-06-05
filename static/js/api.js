let postActions = new Set(["empty-trash", "rate-down", "rate-up", "view",
    "view-all"]);

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
  let data = await resp.json();
  document.dispatchEvent(new CustomEvent(evName, {detail: data}));
}
