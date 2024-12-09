/// <reference types="vite/client" />

declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.svg';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.bmp';
declare module '*.tiff';
declare module '*.json' {
    const value: any;
    export default value;
} 