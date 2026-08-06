(function () {
  const relayBase = "https://k8-realtime.kkkk8888.ccwu.cc";
  const originalFetch = window.fetch.bind(window);

  function extractTicketId(url, method, data) {
    try {
      const parsed = new URL(url, location.href);

      if (parsed.origin === new URL(relayBase).origin) {
        return "";
      }

      if (
        method === "POST" &&
        /\/api\/tickets\/?$/.test(parsed.pathname)
      ) {
        return String(data?.ticket?.id || "");
      }

      const match = parsed.pathname.match(
        /^\/api\/tickets\/([^/]+)(?:\/guest)?$/
      );

      if (
        match &&
        (method === "PATCH" || method === "POST")
      ) {
        return decodeURIComponent(match[1]);
      }
    } catch (_) {
    }

    return "";
  }

  function notifyRelay(ticketId, attempt) {
    if (!ticketId) return;

    originalFetch(relayBase + "/api/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ticketId: ticketId
      }),
      keepalive: true
    })
      .then(function (response) {
        if (!response.ok && attempt < 2) {
          setTimeout(function () {
            notifyRelay(ticketId, attempt + 1);
          }, attempt === 0 ? 500 : 1200);
        }
      })
      .catch(function () {
        if (attempt < 2) {
          setTimeout(function () {
            notifyRelay(ticketId, attempt + 1);
          }, attempt === 0 ? 500 : 1200);
        }
      });
  }

  window.fetch = async function (input, init) {
    const response = await originalFetch(input, init);

    try {
      const url =
        typeof input === "string"
          ? input
          : input.url;

      const method = String(
        init?.method ||
        (typeof input !== "string" ? input.method : "GET") ||
        "GET"
      ).toUpperCase();

      if (!response.ok) {
        return response;
      }

      if (method !== "POST" && method !== "PATCH") {
        return response;
      }

      response
        .clone()
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          const ticketId = extractTicketId(
            url,
            method,
            data
          );

          if (ticketId) {
            notifyRelay(ticketId, 0);
          }
        });
    } catch (_) {
    }

    return response;
  };
})();
