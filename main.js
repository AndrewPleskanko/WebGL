'use strict';

let gl;                         // The webgl context.
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let cassiniModel;
let uSlider, vSlider, uVal, vVal;
let diffuseTexture, specularTexture, normalTexture;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    this.iAttribNormal = -1;
    this.iAttribTangent = -1;
    this.iAttribUV = -1;
    this.iAmbientColor = -1;
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;
    this.iLightPosition = -1;
    this.iViewPosition = -1;
    this.iShininess = -1;
    this.iDiffuseTexture = -1;
    this.iSpecularTexture = -1;
    this.iNormalTexture = -1;
    this.Use = function () {
        gl.useProgram(this.prog);
    }
}

const vertexShaderSource = `
    attribute vec3 vertex;
    attribute vec3 normal;
    attribute vec3 tangent;
    attribute vec2 uv;
    uniform mat4 ModelViewProjectionMatrix;
    uniform mat4 ModelViewMatrix;
    uniform mat3 NormalMatrix;
    varying vec3 vNormal;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    varying vec3 vPosition;
    varying vec2 vUV;
    void main(void) {
        vec4 viewPos = ModelViewMatrix * vec4(vertex, 1.0);
        vPosition = viewPos.xyz;
        
        vec3 N = normalize(NormalMatrix * normal);
        vec3 T = normalize(NormalMatrix * tangent);
        
        float dotNT = dot(N, T);
        vec3 N_ortho = normalize(N - dotNT * T);
        
        // Recalculate bitangent as cross product: B' = cross(N', T)
        vec3 B_ortho = normalize(cross(N_ortho, T));
        
        // Pass orthogonalized TBN to fragment shader
        vNormal = N_ortho;
        vTangent = T;
        vBitangent = B_ortho;
        vUV = uv;
        gl_Position = ModelViewProjectionMatrix * vec4(vertex, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform vec3 lightPosition;
    uniform vec3 viewPosition;
    uniform vec4 ambientColor;
    uniform float shininess;
    varying vec3 vNormal;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    varying vec3 vPosition;
    varying vec2 vUV;
    uniform sampler2D diffuseTexture;
    uniform sampler2D specularTexture;
    uniform sampler2D normalTexture;

    void main(void) {
        // Sample textures
        vec4 diffuseTex = texture2D(diffuseTexture, vUV);
        vec4 specularTex = texture2D(specularTexture, vUV);
        vec3 normalMap = texture2D(normalTexture, vUV).rgb;
        
        // Transform normal from [0,1] to [-1,1]
        normalMap = normalize(normalMap * 2.0 - 1.0);
        
        // Build TBN matrix (Tangent-Bitangent-Normal)
        mat3 TBN = mat3(
            normalize(vTangent),
            normalize(vBitangent),
            normalize(vNormal)
        );
        
        // Transform normal from tangent space to view space
        vec3 N = normalize(TBN * normalMap);
        
        // Lighting calculations
        vec3 L = normalize(lightPosition - vPosition);
        vec3 V = normalize(viewPosition - vPosition);
        vec3 R = reflect(-L, N);
        
        // Phong lighting with textures
        vec3 ambient = ambientColor.rgb * diffuseTex.rgb;
        float diffIntensity = max(dot(N, L), 0.0);
        vec3 diffuse = diffIntensity * diffuseTex.rgb;
        float specIntensity = pow(max(dot(R, V), 0.0), shininess);
        vec3 specular = specIntensity * specularTex.rgb;
        
        if (diffIntensity <= 0.0) {
            specular = vec3(0.0);
        }
        
        vec3 result = ambient + diffuse + specular;
        gl_FragColor = vec4(result, diffuseTex.a);
    }
`;

function animateLight(time) {
    const radius = 5.0;
    const lx = radius * Math.cos(time * 0.5);
    const ly = 3.0;
    const lz = radius * Math.sin(time * 0.5);
    return [lx, ly, lz];
}

function loadTexture(url) {
    return new Promise((resolve, reject) => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        
        const image = new Image();
        image.onload = function() {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

            if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            
            resolve(texture);
        };
        image.onerror = reject;
        image.src = url;
    });
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    let aspect = gl.canvas.width / gl.canvas.height;
    let projection = m4.perspective(Math.PI / 8, aspect, 8, 12);

    let modelViewFromBall = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    let modelMatrix = m4.multiply(rotateToPointZero, modelViewFromBall);
    let modelViewMatrix = m4.multiply(translateToPointZero, modelMatrix);
    let modelViewProjection = m4.multiply(projection, modelViewMatrix);

    let normalMatrix4 = m4.transpose(m4.inverse(modelViewMatrix));
    let normalMatrix = [
        normalMatrix4[0], normalMatrix4[1], normalMatrix4[2],
        normalMatrix4[4], normalMatrix4[5], normalMatrix4[6],
        normalMatrix4[8], normalMatrix4[9], normalMatrix4[10]
    ];

    shProgram.Use();

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewMatrix);
    gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, normalMatrix);
    gl.uniform4fv(shProgram.iAmbientColor, [0.1, 0.1, 0.1, 1.0]);
    gl.uniform1f(shProgram.iShininess, 32.0);

    // Animated light in world coords
    const time = performance.now() * 0.001;
    const lightWorldPos = animateLight(time);

    const lightViewPos = m4.transformPoint(modelViewMatrix, lightWorldPos);

    gl.uniform3fv(shProgram.iLightPosition, lightViewPos);

    gl.uniform3fv(shProgram.iViewPosition, [0, 0, 0]);

    if (diffuseTexture && specularTexture && normalTexture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, diffuseTexture);
        gl.uniform1i(shProgram.iDiffuseTexture, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, specularTexture);
        gl.uniform1i(shProgram.iSpecularTexture, 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.uniform1i(shProgram.iNormalTexture, 2);
    } else {
        // Don't draw if textures aren't loaded yet
        return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, cassiniModel.vertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, cassiniModel.normalBuffer);
    gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribNormal);

    gl.bindBuffer(gl.ARRAY_BUFFER, cassiniModel.tangentBuffer);
    gl.vertexAttribPointer(shProgram.iAttribTangent, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribTangent);

    gl.bindBuffer(gl.ARRAY_BUFFER, cassiniModel.uvBuffer);
    gl.vertexAttribPointer(shProgram.iAttribUV, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribUV);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cassiniModel.indexBuffer);
    gl.drawElements(gl.TRIANGLES, cassiniModel.meshIndices.length, gl.UNSIGNED_SHORT, 0);
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

    shProgram = new ShaderProgram('Phong', prog);
    shProgram.Use();

    shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribNormal = gl.getAttribLocation(prog, "normal");
    shProgram.iAttribTangent = gl.getAttribLocation(prog, "tangent");
    shProgram.iAttribUV = gl.getAttribLocation(prog, "uv");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iAmbientColor = gl.getUniformLocation(prog, "ambientColor");
    shProgram.iLightPosition = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iViewPosition = gl.getUniformLocation(prog, "viewPosition");
    shProgram.iShininess = gl.getUniformLocation(prog, "shininess");
    shProgram.iDiffuseTexture = gl.getUniformLocation(prog, "diffuseTexture");
    shProgram.iSpecularTexture = gl.getUniformLocation(prog, "specularTexture");
    shProgram.iNormalTexture = gl.getUniformLocation(prog, "normalTexture");

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

    // Load textures
    Promise.all([
        loadTexture('imgs/brick_diffuse.png'),
        loadTexture('imgs/brick_specular.png'),
        loadTexture('imgs/brick_normal.png')
    ]).then(textures => {
        diffuseTexture = textures[0];
        specularTexture = textures[1];
        normalTexture = textures[2];
    }).catch(err => {
        console.error('Error loading textures:', err);
    });

    function regenerateModel() {
        let uSegs = parseInt(uSlider.value);
        let vSegs = parseInt(vSlider.value);
        uVal.textContent = uSegs;
        vVal.textContent = vSegs;
        cassiniModel = new Model({uSegments: uSegs, vSegments: vSegs});
        cassiniModel.bufferMeshData(gl);
    }

    uSlider = document.getElementById("u-slider");
    vSlider = document.getElementById("v-slider");
    uVal = document.getElementById("u-val");
    vVal = document.getElementById("v-val");

    uSlider.addEventListener("input", regenerateModel);
    vSlider.addEventListener("input", regenerateModel);

    regenerateModel();
}

function animate() {
    draw();
    requestAnimationFrame(animate);
}

function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vsh, vShader);
    gl.compileShader(vsh);
    if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
    }
    let fsh = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
        throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if (!gl) {
            throw "Browser does not support WebGL";
        }
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML = "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();
    } catch (e) {
        document.getElementById("canvas-holder").innerHTML = "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    spaceball = new TrackballRotator(canvas, draw, 0);

    animate();
}