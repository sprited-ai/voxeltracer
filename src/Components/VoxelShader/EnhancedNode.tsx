import React from "react";
import { Node, GLSL } from "gl-react";

declare module 'gl-react' {
  interface Node {
    _prepareGLObjects(gl: WebGLRenderingContext): void;
  }
}

/**
 * Super hacky stuff to enable floating point frame buffers
 */
class EnhancedNode extends Node {
  _prepareGLObjects(gl: WebGLRenderingContext): void {

    let ext;
    
    const webGLVersion = gl.getParameter(gl.VERSION);

    console.log(webGLVersion, 'WebGL version')

    if (webGLVersion.includes('WebGL 2')) {
      return super._prepareGLObjects(gl);
    }
    // Load extension for floating point frame buffers. iOS device
    // (currently iOS 12) does not really support 32bit floating
    // points frame buffers (it says it does, but not really). You
    // can confirm this by checking if attaching framebuffer returns
    // some error or not. If interested please take a look as I
    // haven't done a through research.
    else if (ext = gl.getExtension('OES_texture_half_float')) {
      const halfFloat = ext.HALF_FLOAT_OES;
      console.log('Using OES_texture_half_float WebGL extension.');

      // Fool gl-react to use half-float instead of
      // gl.UNSIGNED_BYTE for its frame buffer type.
      const glProxy = new Proxy(gl, {
        get(gl: WebGLRenderingContext, prop: string) {
          switch(prop) {
            case 'UNSIGNED_BYTE': return halfFloat;
            default:
              const member = (gl as any)[prop];
              return typeof member === 'function' ? member.bind(gl) : member;
          }
        }
      });
      return super._prepareGLObjects(glProxy);
    }
    // If 16bit float is not available run 32bit float. I don't think
    // any browser will ever hit this block. 16bit seems to work well
    // enough. This code could probably be removed without much risk.
    // Just keeping it there for record.
    else if (ext = gl.getExtension('OES_texture_float')) {
      console.log('Using OES_texture_float WebGL extension.');

      // Fool gl-react to use gl.FLOAT instead of
      // gl.UNSIGNED_BYTE for its frame buffer type.
      const glProxy = new Proxy(gl, {
        get(gl: WebGLRenderingContext, prop: string) {
          switch(prop) {
            case 'UNSIGNED_BYTE': return gl.FLOAT;
            default:
              const member = (gl as any)[prop];
              return typeof member === 'function' ? member.bind(gl) : member;
          }
        }
      });
      return super._prepareGLObjects(glProxy);
    }
    // If both are not supported, just use unsigned byte.
    // Gives bad result. No browser which supports WebGL should hit this path anyways.
    else {
      console.log('OES_texture_float WebGL extension is not available.');
      return super._prepareGLObjects(gl);
    }
  }
}

export default EnhancedNode;
