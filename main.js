'use strict';

let gl;                         // The webgl context.
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let cassiniModel;
let uSlider, vSlider, uVal, vVal;

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
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;
    this.iModelViewMatrix = -1;
    this.iNormalMatrix = -1;
    this.iLightPosition = -1;
    this.Use = function () {
        gl.useProgram(this.prog);
    }
}

const vertexShaderSource = `
    attribute vec3 vertex;
    attribute vec3 normal;
    uniform mat4 ModelViewProjectionMatrix;
    uniform mat4 ModelViewMatrix;
    uniform mat3 NormalMatrix;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main(void) {
        vec4 viewPos = ModelViewMatrix * vec4(vertex, 1.0);
        vPosition = viewPos.xyz;
        vNormal = normalize(NormalMatrix * normal);
        gl_Position = ModelViewProjectionMatrix * vec4(vertex, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 color;
    uniform vec3 lightPosition;
    varying vec3 vNormal;
    varying vec3 vPosition;

    void main(void) {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(lightPosition - vPosition); // вектор до світла
        vec3 V = normalize(-vPosition);                // до камери
        vec3 R = reflect(-L, N);                       // відбитий промінь

        // Освітлення Phong
        vec3 ambient = 0.1 * color.rgb;
        vec3 diffuse = max(dot(N, L), 0.0) * color.rgb;
        vec3 specular = pow(max(dot(R, V), 0.0), 32.0) * vec3(1.0); // блиск

        vec3 result = ambient + diffuse + specular;
        gl_FragColor = vec4(result, 1.0);
    }
`;

function animateLight(time) {
    const radius = 5.0;
    const lx = radius * Math.cos(time * 0.5);
    const ly = 3.0;
    const lz = radius * Math.sin(time * 0.5);
    return [lx, ly, lz];
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Ensure viewport matches canvas size
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Use canvas aspect ratio
    let aspect = gl.canvas.width / gl.canvas.height;
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI / 8, aspect, 8, 12);

    // Get view (rotation) from trackball
    let modelViewFromBall = spaceball.getViewMatrix();
    let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0.7);
    let translateToPointZero = m4.translation(0, 0, -10);

    // modelMatrix includes rotation from trackball and another rotation
    let modelMatrix = m4.multiply(rotateToPointZero, modelViewFromBall);
    // ModelView = Translate * ModelMatrix
    let modelViewMatrix = m4.multiply(translateToPointZero, modelMatrix);
    let modelViewProjection = m4.multiply(projection, modelViewMatrix);

    // Normal matrix for transforming normals
    let normalMatrix4 = m4.transpose(m4.inverse(modelViewMatrix));
    let normalMatrix = [
        normalMatrix4[0], normalMatrix4[1], normalMatrix4[2],
        normalMatrix4[4], normalMatrix4[5], normalMatrix4[6],
        normalMatrix4[8], normalMatrix4[9], normalMatrix4[10]
    ];

    shProgram.Use();

    // Send matrices & material color
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection);
    gl.uniformMatrix4fv(shProgram.iModelViewMatrix, false, modelViewMatrix);
    gl.uniformMatrix3fv(shProgram.iNormalMatrix, false, normalMatrix);
    gl.uniform4fv(shProgram.iColor, [0.2, 0.7, 1.0, 1.0]);

    // Animated light in world coords
    const time = performance.now() * 0.001;
    const lightWorldPos = animateLight(time);

    const lightViewPos = m4.transformPoint(modelViewMatrix, lightWorldPos);

    gl.uniform3fv(shProgram.iLightPosition, lightViewPos);

    // Bind buffers and draw
    gl.bindBuffer(gl.ARRAY_BUFFER, cassiniModel.vertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, cassiniModel.normalBuffer);
    gl.vertexAttribPointer(shProgram.iAttribNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribNormal);

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
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iModelViewMatrix = gl.getUniformLocation(prog, "ModelViewMatrix");
    shProgram.iNormalMatrix = gl.getUniformLocation(prog, "NormalMatrix");
    shProgram.iColor = gl.getUniformLocation(prog, "color");
    shProgram.iLightPosition = gl.getUniformLocation(prog, "lightPosition");

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);

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

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
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