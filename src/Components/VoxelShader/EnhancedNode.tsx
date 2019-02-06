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

    // Load extension for floating point frame buffers.
    if (gl.getExtension('OES_texture_float')) {
      console.log('Using OES_texture_float WebGL extension.');
      // Fool gl-react to use gl.FLOAT instead of
      // gl.UNSIGNED_BYTE for its frame buffer type.
      const glProxy = new Proxy(gl, {
        get(gl: WebGLRenderingContext, prop: string) {
          // console.log(`Proxying gl.${prop}`);
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
    else {
      console.log('OES_texture_float WebGL extension is not available.');
      return super._prepareGLObjects(gl);
    }
  }
}

export default EnhancedNode;
