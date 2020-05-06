const rotation_speed = 0.002;
const colour_speed = 0.007;
const opacity_speed = 0.1;
const fft = 128; // needs to be power of 2, represents 2 * n points
const edge = 0.6; // border blank for expansion
const background = "#000000";

class LineSet {
    constructor() {
        this.lines = [];
    }

    add(line) {
        this.lines.push(line);

    }

    draw(canvas, ctx) {
        this.lines.forEach(line => {
            line.draw(canvas, ctx);
        });
    }
}

class Colour {
    constructor(r = 255, g = 255, b = 255, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    getRGB(a = 1) {
        return "rgba(" + this.r + ", " + this.g + ", " + this.b + ", " + a + ")";
    }

    getRGBA() {
        return "rgba(" + this.r + ", " + this.g + ", " + this.b + ", " + this.a + ")";
    }

    customColour(fraction) {
        let n = 0.25; // pastel
        const mod = (x, y) => y * (x / y - Math.floor(x / y));
        let i = 100 * fraction;
        let a = 765;
        let p = 100;

        let gd = 33.33;
        let bd = 66.66;

        let r = Math.min(Math.max(2 * a / p * Math.abs(mod(i, p) - p / 2) - 2 * a / 4 + a / 6, 0), 255);
        let g = Math.min(Math.max(2 * a / p * Math.abs(mod((i - gd), p) - p / 2) - 2 * a / 4 + a / 6, 0), 255);
        let b = Math.min(Math.max(2 * a / p * Math.abs(mod((i - bd), p) - p / 2) - 2 * a / 4 + a / 6, 0), 255);

        this.r = r + (255 - r) * n;
        this.g = g + (255 - g) * n;
        this.b = b + (255 - b) * n;

        return this;
    }

    customOpacity(fraction) {
        this.a = 1 / 4 * Math.cos(2 * fraction * Math.PI) + 1 / 2;
        return this;
    }
}

class Point {
    constructor(l) {
        this.l = l;
        this.box = l * edge;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.colour = new Colour();
    }

    copy() {
        let copy = new Point(this.l);
        copy.box = this.box;
        copy.x = this.x;
        copy.y = this.y;
        copy.z = this.z;
        copy.colour = this.colour;
        return copy;
    }

    generateRandom() {
        this.x = Math.round(Math.random() * this.box - this.box / 2);
        this.y = Math.round(Math.random() * this.box - this.box / 2);
        this.z = Math.round(Math.random() * this.box - this.box / 2);
        return this;
    }

    offset(o) {
        let magnitude = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2));
        let norm = {x: this.x / magnitude, y: this.y / magnitude, z: this.z / magnitude};
        this.x = Math.round(this.x + (norm.x * o));
        this.y = Math.round(this.y + (norm.y * o));
        this.z = Math.round(this.z + (norm.z * o));
        return this;
    }

    rotate_x(n) {
        n %= 360;
        let ty = Math.cos(n) * this.y - Math.sin(n) * this.z;
        let tz = Math.sin(n) * this.y + Math.cos(n) * this.z;
        this.y = ty;
        this.z = tz;
        return this;
    }

    rotate_y(n) {
        n %= 360;
        let tx = Math.cos(n) * this.x - Math.sin(n) * this.z;
        let tz = Math.sin(n) * this.x + Math.cos(n) * this.z;
        this.x = tx;
        this.z = tz;
        return this;
    }

    rotate_z(n) {
        n %= 360;
        let tx = Math.cos(n) * this.x - Math.sin(n) * this.y;
        let ty = Math.sin(n) * this.x + Math.cos(n) * this.y;
        this.x = tx;
        this.y = ty;
        return this;
    }

    dist(p) {
        return Math.sqrt(Math.pow(this.x - p.x, 2) + Math.pow(this.y - p.y, 2) + Math.pow(this.z - p.z, 2));
    }

    closest(z, points) {
        let closest = [];
        for (let j = 0; j < points.length; j++) {
            let closepoint = {...points[j]};
            closepoint.distance = this.dist(closepoint);
            closest.push(closepoint);
        }
        
        return closest.sort((a, b) => (a.distance - b.distance)).slice(1, 8);
    }

    draw(canvas, ctx) {
        try {
            ctx.beginPath();
            let size = Math.max(2, 6 + Math.round(8 / this.l * this.z));
            ctx.arc(this.x + canvas.width / 2, this.y + canvas.height / 2, size, 0, 2 * Math.PI,);
            ctx.fillStyle = this.colour.getRGB(0.8);
            ctx.fill();
        } catch (e) {
            console.log("Z spiked outside of range")
        }
    }
}

class Line {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
    }

    draw(canvas, ctx) {
        ctx.beginPath();
        ctx.strokeStyle = this.p1.colour.getRGBA();
        ctx.lineWidth = (this.p1.z + this.p1.l / 2 + this.p2.z + this.p2.l / 2) / (2 * this.p1.l) * 3.5 + 0.2;
        ctx.moveTo(this.p1.x + canvas.width / 2, this.p1.y + canvas.height / 2);
        ctx.lineTo(this.p2.x + canvas.width / 2, this.p2.y + canvas.height / 2);

        ctx.stroke();
    }
}


window.onload = function () {
    navigator.mediaDevices.getUserMedia({audio: true, video: false})
        .then(stream => {
            let audioCtx = new window.AudioContext();
            let source = audioCtx.createMediaStreamSource(stream);

            let freqanalyser = audioCtx.createAnalyser();
            source.connect(freqanalyser);

            freqanalyser.fftSize = fft;
            let bufferLength = freqanalyser.frequencyBinCount;
            let dataArray = new Uint8Array(bufferLength);

            let canvas = document.getElementById("cv");
            let ctx = canvas.getContext("2d");

            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            let points = [];
            for (let i = 0; i < bufferLength; i++) {
                points.push(new Point(Math.min(canvas.height, canvas.width)).generateRandom());
            }

            let rotation = 0;
            let colourshift = 0;
            let opacity = 0;

            function draw() {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                requestAnimationFrame(draw);
                freqanalyser.getByteFrequencyData(dataArray);

                ctx.fillStyle = background;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                let frame_points = points.map(p => p.copy());
                for (let i = 0; i < bufferLength; i++) {
                    frame_points[i].offset(dataArray[i]).rotate_x(rotation).rotate_y(rotation).rotate_z(rotation);
                    frame_points[i].colour.customColour(colourshift / bufferLength).customOpacity(opacity / 100);
                }

                let lines = new LineSet();

                for (let i = 0; i < frame_points.length; i++) {
                    frame_points[i].closest(frame_points[i].z, frame_points).forEach(p => {
                        lines.add(new Line(frame_points[i], p));
                    });
                }

                lines.draw(canvas, ctx);
                frame_points.forEach(p => {
                    p.draw(canvas, ctx)
                });

                console.log(lines.lines.length);

                colourshift += colour_speed;
                colourshift %= bufferLength;
                opacity += opacity_speed;
                opacity %= 100;
                rotation += rotation_speed;
            }

            draw();
        });
};
