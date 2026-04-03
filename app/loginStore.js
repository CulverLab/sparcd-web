// loginStore.js

export function loadURL() {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem('login.url');
  }
}

export function loadUsername() {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem('login.user');
  }
}

export function loadRemember() {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem('login.remember');
  }
}

export function saveURL(url) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem('login.url', String(url));
  }
}

export function saveUsername(username) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem('login.user', String(username));
  }
}

export function saveRemember(remember) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem('login.remember', !!remember);
  }
}

export function loadLoginInfo() {
  let loadedUrl = loadURL();
  if (!loadedUrl) {
    clearLoginInfo();
  }
  return {
    url: loadedUrl,
    user: loadUsername(),
    remember: loadRemember(),
  };
}

export function saveLoginInfo(url, username, remember) {
  saveURL(url);
  saveUsername(username);
  saveRemember(remember);
}

export function clearLoginInfo() {
  saveURL('');
  saveUsername('');
  saveRemember(false);
}

export function loadLoginToken() {
  if (typeof window !== "undefined") {
    const curToken = window.localStorage.getItem('login.token');
    return curToken ? curToken : null;
  }
  return null;
}

export function saveLoginToken(token) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem('login.token', String(token));
  }
}

export function clearLoginToken() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem('login.token', '');
  }
}
