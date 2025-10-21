(function () {
    // Constructor
    function Model(options) {
        options = options || {};
        this.uSegments = options.uSegments || 40;
        this.vSegments = options.vSegments || 40;

        this.a = 1;
        this.c = 1;
        this.k = 1.1;

        this.meshVertices = null;
        this.meshNormals = null;
        this.meshIndices = null;
        this.vertexBuffer = null;
        this.normalBuffer = null;
        this.indexBuffer = null;

        this.createMeshData();
    }

    Model.prototype.cassini = function (u, v) {
        var a = this.a, c = this.c, k = this.k;
        var r = Math.pow(Math.pow(Math.cos(2 * v), 2) + Math.pow(k, 4) - Math.pow(Math.sin(2 * v), 2), 0.25);
        if (isNaN(r)) r = 0; // Додано перевірку, щоб уникнути NaN
        var x = a * r * Math.cos(u);
        var y = a * r * Math.sin(u);
        var z = c * Math.sin(v);
        return [x, y, z];
    };

    Model.prototype.createMeshData = function () {
        const uSegs = this.uSegments;
        const vSegs = this.vSegments;
        const uMin = -Math.PI, uMax = Math.PI;
        const vMin = -Math.PI / 4, vMax = Math.PI / 4;

        let vertices = [];

        for (let j = 0; j <= vSegs; ++j) {
            let v = vMin + (vMax - vMin) * j / vSegs;
            for (let i = 0; i <= uSegs; ++i) {
                let u = uMin + (uMax - uMin) * i / uSegs;
                let pt = this.cassini(u, v);
                vertices.push(pt[0], pt[1], pt[2]);
            }
        }

        // Генеруємо індекси для трикутників
        let indices = [];
        for (let j = 0; j < vSegs; ++j) {
            for (let i = 0; i < uSegs; ++i) {
                let i0 = j * (uSegs + 1) + i;
                let i1 = i0 + 1;
                let i2 = i0 + (uSegs + 1);
                let i3 = i2 + 1;
                indices.push(i0, i1, i2);
                indices.push(i1, i3, i2);
            }
        }

        // Розрахунок нормалей (Facet Area Weighted)
        let normals = new Array(vertices.length).fill(0);

        // --- ЕТАП 1: Накопичення зважених нормалей ---
        for (let t = 0; t < indices.length; t += 3) {
            let i0 = indices[t] * 3, i1 = indices[t + 1] * 3, i2 = indices[t + 2] * 3;

            let v0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
            let v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
            let v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

            let a = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
            let b = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

            // Векторний добуток (його довжина ВЖЕ зважена за площею)
            let nx = a[1] * b[2] - a[2] * b[1];
            let ny = a[2] * b[0] - a[0] * b[2];
            let nz = a[0] * b[1] - a[1] * b[0];

            // Додаємо цей вектор до кожної з трьох вершин
            normals[i0] += nx;
            normals[i0 + 1] += ny;
            normals[i0 + 2] += nz;
            normals[i1] += nx;
            normals[i1 + 1] += ny;
            normals[i1 + 2] += nz;
            normals[i2] += nx;
            normals[i2 + 1] += ny;
            normals[i2 + 2] += nz;
        }

        for (let i = 0; i < normals.length; i += 3) {
            let nx = normals[i], ny = normals[i + 1], nz = normals[i + 2];
            let len = Math.hypot(nx, ny, nz);
            if (len > 0.00001) {
                normals[i] /= len;
                normals[i + 1] /= len;
                normals[i + 2] /= len;
            }
        }

        this.meshVertices = new Float32Array(vertices);
        this.meshNormals = new Float32Array(normals);
        this.meshIndices = new Uint16Array(indices);
    };

    Model.prototype.bufferMeshData = function (gl) {
        if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
        if (this.normalBuffer) gl.deleteBuffer(this.normalBuffer);
        if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.meshVertices, gl.STATIC_DRAW);

        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.meshNormals, gl.STATIC_DRAW);

        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.meshIndices, gl.STATIC_DRAW);
    };

    window.Model = Model;
})();
