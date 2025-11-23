/**
 * Type declarations for image imports
 */

declare module '*.png' {
  const content: StaticImageData;
  export default content;
}

declare module '*.jpg' {
  const content: StaticImageData;
  export default content;
}

declare module '*.jpeg' {
  const content: StaticImageData;
  export default content;
}

declare module '*.gif' {
  const content: StaticImageData;
  export default content;
}

declare module '*.webp' {
  const content: StaticImageData;
  export default content;
}

declare module '*.svg' {
  const content: StaticImageData;
  export default content;
}

interface StaticImageData {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
}
