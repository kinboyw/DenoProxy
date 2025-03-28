// ... existing code ...

Deno.serve(async (req) => {
  const url = new URL(req.url);
  
  // 获取第一个路径段作为代理URL
  const pathSegments = url.pathname.split('/').filter(segment => segment);
  if (pathSegments.length > 0) {
    try {
      // 解码并构造目标URL
      const proxyUrl = decodeURIComponent(pathSegments[0]);
      const targetPath = '/' + pathSegments.slice(1).join('/');
      
      // 确保是有效的URL
      let targetUrl: string;
      try {
        targetUrl = new URL(proxyUrl.startsWith('http') ? proxyUrl : `https://${proxyUrl}`).toString();
        // 添加剩余路径和查询参数
        targetUrl = new URL(targetPath + url.search, targetUrl).toString();
      } catch {
        return new Response("无效的目标URL", { status: 400 });
      }

      // 构造代理请求
      const proxyRequest = new Request(targetUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      });

      try {
        const targetResponse = await fetch(proxyRequest);
        const body = await targetResponse.arrayBuffer();

        // 复制响应头
        const responseHeaders = new Headers();
        for (const [key, value] of targetResponse.headers.entries()) {
          responseHeaders.set(key, value);
        }

        // 修改响应中的链接，使其通过代理
        if (responseHeaders.get('content-type')?.includes('text/html')) {
          const text = new TextDecoder().decode(body);
          const modifiedText = text.replace(
            /(href|src)="(\/[^"]*|https?:\/\/[^"]*)/g,
            (match, attr, url) => {
              if (url.startsWith('http')) {
                return `${attr}="/${encodeURIComponent(url)}`;
              } else if (url.startsWith('/')) {
                return `${attr}="/${encodeURIComponent(targetUrl.replace(/\/[^/]*$/, '') + url)}`;
              }
              return match;
            }
          );
          return new Response(modifiedText, {
            status: targetResponse.status,
            headers: responseHeaders,
          });
        }

        return new Response(body, {
          status: targetResponse.status,
          headers: responseHeaders,
        });
      } catch (err) {
        return new Response(`代理请求失败：${err}`, { status: 500 });
      }
    } catch (err) {
      return new Response(`URL处理错误：${err}`, { status: 400 });
    }
  }

  // 默认响应
  return new Response(
    "请使用格式：https://your-proxy-domain.com/target-url\n" +
    "例如：https://your-proxy-domain.com/example.com/path"
  );
});