// Custom shader passes for synthwave post-processing

export const ChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.002 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    varying vec2 vUv;
    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float aberration = offset * dist * dist * 3.0;
      vec4 r = texture2D(tDiffuse, vUv + center * aberration);
      vec4 g = texture2D(tDiffuse, vUv);
      vec4 b = texture2D(tDiffuse, vUv - center * aberration);
      gl_FragColor = vec4(r.r, g.g, b.b, 1.0);
    }
  `,
};

export const ScanlineShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.018 },
    lineFrequency: { value: 800.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    uniform float lineFrequency;
    varying vec2 vUv;
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float line = sin((vUv.y + time * 0.02) * lineFrequency) * 0.5 + 0.5;
      color.rgb -= line * intensity;
      gl_FragColor = color;
    }
  `,
};

export const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteIntensity: { value: 0.47 },
    saturation: { value: 1.15 },
    // Shift shadows toward deep blue, highlights toward cyan/pink
    shadowColor: { value: { x: 0.05, y: 0.0, z: 0.1 } },
    highlightColor: { value: { x: 0.0, y: 0.05, z: 0.05 } },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteIntensity;
    uniform float saturation;
    uniform vec3 shadowColor;
    uniform vec3 highlightColor;
    varying vec2 vUv;

    vec3 applySaturation(vec3 c, float s) {
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      return mix(vec3(lum), c, s);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Saturation boost
      color.rgb = applySaturation(color.rgb, saturation);

      // Color grading: push shadows blue, highlights cyan-pink
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 shadowShift = shadowColor * (1.0 - lum);
      vec3 highlightShift = highlightColor * lum;
      color.rgb += shadowShift + highlightShift;

      // Vignette
      vec2 center = vUv - 0.5;
      float vig = 1.0 - dot(center, center) * vignetteIntensity * 3.5;
      color.rgb *= vig;

      gl_FragColor = color;
    }
  `,
};

export const FilmGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    intensity: { value: 0.018 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453 + time);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      float grain = rand(vUv) * 2.0 - 1.0;
      color.rgb += grain * intensity;
      gl_FragColor = color;
    }
  `,
};
