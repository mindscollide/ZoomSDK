
export function isShallowEqual(objA: any, objB: any) {
  if (objA === objB) {
    return true;
  }

  if (!objA || !objB) {
    return false;
  }

  const aKeys = Object.keys(objA);
  const bKeys = Object.keys(objB);
  const len = aKeys.length;

  if (bKeys.length !== len) {
    return false;
  }

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < len; i++) {
    const key = aKeys[i];

    if (objA[key] !== objB[key] || !Object.hasOwn(objB, key)) {
      return false;
    }
  }

  return true;
}

export function isArrayShallowEqual(arrayA: Array<any>, arrayB: Array<any>) {
  const len = arrayA.length;
  if (arrayB.length !== len) {
    return false;
  }
  for (let i = 0; i < len; i++) {
    if (!isShallowEqual(arrayA[i], arrayB[i])) {
      return false;
    }
  }
  return true;
}

export function b64EncodeUnicode(str: any) {
  // first we use encodeURIComponent to get percent-encoded UTF-8,
  // then we convert the percent encodings into raw bytes which
  // can be fed into btoa.
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(('0x' + p1) as any);
    })
  );
}

export function b64DecodeUnicode(str: any) {
  // Going backwards: from bytestream, to percent-encoding, to original string.
  return decodeURIComponent(
    atob(str)
      .split('')
      .map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );
}

export function loadExternalResource(url: string, type: 'script' | 'style') {
  return new Promise((resolve, reject) => {
    let element: HTMLScriptElement | HTMLLinkElement | undefined;
    if (type === 'script') {
      element = document.createElement('script');
      element.src = url;
      element.async = true;
      element.type = 'text/javascript';
    } else if (type === 'style') {
      element = document.createElement('link');
      element.href = url;
      element.rel = 'stylesheet';
    }
    if (element) {
      if ((element as any).readyState) {
        (element as any).onreadystatechange = () => {
          if ((element as any).readyState === 'loaded' || (element as any).readyState === 'complete') {
            (element as any).onreadystatechange = null;
            resolve('');
          }
        };
      } else {
        element.onload = () => {
          resolve('');
        };
        element.onerror = () => {
          reject(new Error(''));
        };
      }
      if (typeof document.body.append === 'function') {
        document.getElementsByTagName('head')[0].append(element);
      } else {
        document.getElementsByTagName('head')[0].appendChild(element);
      }
    } else {
      reject(new Error(''));
    }
  });
}

export function parseJwt(token: string) {
  let base64Url = token.split('.')[1];
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  let jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split('')
      .map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join('')
  );

  return JSON.parse(jsonPayload);
}
