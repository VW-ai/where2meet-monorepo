const answers = JSON.parse(process.env.FAKE_GEOCODE_ANSWERS ?? "{}");

globalThis.fetch = async (url) => {
  const address = new URL(String(url)).searchParams.get("address") ?? "";
  const answer = answers[address] ?? {
    status: "REQUEST_DENIED",
    error_message: "Not in the fake",
    results: [],
  };
  return new Response(JSON.stringify(answer), { status: 200 });
};
