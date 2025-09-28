(function () {
    function Model(options) {
        options = options || {};
        this.a = options.a !== undefined ? options.a : 1;
        this.c = options.c !== undefined ? options.c : 1;
        this.k = options.k !== undefined ? options.k : 1.1;
        this.uLines = options.uLines || 20;
        this.vLines = options.vLines || 20;
        this.uSteps = options.uSteps || 50;
        this.vSteps = options.vSteps || 50;

        this.verticesU = null;
        this.offsetsU = [];
        this.verticesV = null;
        this.offsetsV = [];
        this.uBuffer = null;
        this.vBuffer = null;
    }

    Model.prototype.cassini = function (u, v) {
        var a = this.a, c = this.c, k = this.k;
        var r = Math.pow(Math.pow(Math.cos(2 * v), 2) + Math.pow(k, 4) - Math.pow(Math.sin(2 * v), 2), 0.25);
        var x = a * r * Math.cos(u);
        var y = a * r * Math.sin(u);
        var z = c * Math.sin(v);
        return [x, y, z];
    };

    Model.prototype.createSurfaceData = function () {
        var uMin = -Math.PI, uMax = Math.PI;
        var vMin = -Math.PI / 4, vMax = Math.PI / 4;
        var uLines = this.uLines, vLines = this.vLines;
        var uSteps = this.uSteps, vSteps = this.vSteps;

        // U-криві (v фіксується, u змінюється)
        var verticesU = [];
        var offsetsU = [];
        for (var j = 0; j < vLines; ++j) {
            var v = vMin + (vMax - vMin) * j / (vLines - 1);
            var offset = verticesU.length / 3;
            for (var i = 0; i < uSteps; ++i) {
                var u = uMin + (uMax - uMin) * i / (uSteps - 1);
                var pt = this.cassini(u, v);
                verticesU.push(pt[0], pt[1], pt[2]);
            }
            offsetsU.push({offset: offset, count: uSteps});
        }
        this.verticesU = new Float32Array(verticesU);
        this.offsetsU = offsetsU;

        // V-криві (u фіксується, v змінюється)
        var verticesV = [];
        var offsetsV = [];
        for (var i = 0; i < uLines; ++i) {
            var u = uMin + (uMax - uMin) * i / (uLines - 1);
            var offset = verticesV.length / 3;
            for (var j = 0; j < vSteps; ++j) {
                var v = vMin + (vMax - vMin) * j / (vSteps - 1);
                var pt = this.cassini(u, v);
                verticesV.push(pt[0], pt[1], pt[2]);
            }
            offsetsV.push({offset: offset, count: vSteps});
        }
        this.verticesV = new Float32Array(verticesV);
        this.offsetsV = offsetsV;
    };

    Model.prototype.bufferData = function (gl) {
        this.uBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.verticesU, gl.STATIC_DRAW);

        this.vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.verticesV, gl.STATIC_DRAW);
    };

    Model.prototype.draw = function (gl, program, mvpMatrix, color) {
        gl.uniformMatrix4fv(program.iModelViewProjectionMatrix, false, mvpMatrix);
        gl.uniform4fv(program.iColor, color);

        // Малюємо U-криві
        gl.bindBuffer(gl.ARRAY_BUFFER, this.uBuffer);
        gl.vertexAttribPointer(program.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.iAttribVertex);
        for (var i = 0; i < this.offsetsU.length; ++i) {
            var o = this.offsetsU[i];
            gl.drawArrays(gl.LINE_STRIP, o.offset, o.count);
        }

        // Малюємо V-криві
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vBuffer);
        gl.vertexAttribPointer(program.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(program.iAttribVertex);
        for (var i = 0; i < this.offsetsV.length; ++i) {
            var o = this.offsetsV[i];
            gl.drawArrays(gl.LINE_STRIP, o.offset, o.count);
        }
    };

    // Робимо Model доступним глобально
    window.Model = Model;
})();