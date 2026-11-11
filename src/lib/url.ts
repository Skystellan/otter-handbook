const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/** 站内链接一律走这里，部署到子路径（GitHub Pages）时不用改任何页面。 */
export const url = (path = '/') => `${base}${path.startsWith('/') ? path : `/${path}`}`;

export const isCurrent = (pathname: string, href: string) => {
  const here = pathname.replace(/\/$/, '') || '/';
  const target = url(href).replace(/\/$/, '') || '/';
  return target === '/' ? here === '/' : here === target || here.startsWith(`${target}/`);
};
