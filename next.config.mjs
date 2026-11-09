/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // /trips reads like the list of trips, and that list is the chooser on
      // the home page. Temporary (307), so a real /trips index page could
      // replace this later without browsers having cached the redirect.
      { source: "/trips", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
