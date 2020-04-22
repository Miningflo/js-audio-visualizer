const rotation_speed = 0.006;
const fft = 128; // needs to be power of 2, represents 2 * n points
const edge = 0.6; // border blank for expansion
const drawing = 'rgba(255, 255, 255, 0.7)';
const background = "#000000";

class Point {
    constructor(l, colour, x = 0, y = 0, z = 0) {
        this.l = l;
        this.box = l * edge;
        this.x = x;
        this.y = y;
        this.z = z;
        this.colour = colour;
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
        return new Point(
            this.l,
            this.colour,
            Math.round(this.x + (norm.x * o)),
            Math.round(this.y + (norm.y * o)),
            Math.round(this.z + (norm.z * o))
        );
    }

}

class Line {
    constructor(p1, p2) {
        this.p1 = p1;
        this.p2 = p2;
    }

    toString = function () {
        let sorted = [this.p1, this.p2].sort((p1, p2) => {
            if (p1.x !== p2.x) {
                return p1.x - p2.x;
            } else {
                return p1.y - p2.y;
            }
        });
        return JSON.stringify(sorted);
    }
}


function customColour(fraction) {
    let n = 0.25;
    const mod = (x, y) => y * (x / y - Math.floor(x / y));
    let i = 100 * fraction;
    let a = 765;
    let p = 100;

    let gd = 33.33;
    let bd = 66.66;

    let r = Math.min(Math.max(2 * a / p * Math.abs(mod(i, p) - p / 2) - 2 * a / 4 + a / 6, 0), 255);
    let g = Math.min(Math.max(2 * a / p * Math.abs(mod((i - gd), p) - p / 2) - 2 * a / 4 + a / 6, 0), 255);
    let b = Math.min(Math.max(2 * a / p * Math.abs(mod((i - bd), p) - p / 2) - 2 * a / 4 + a / 6, 0), 255);

    r = r + (255 - r) * n;
    g = g + (255 - g) * n;
    b = b + (255 - b) * n;

    return "rgb(" + r + ", " + g + ", " + b + ")";
}

function drawpoints(points, canvas, ctx) {
    points.forEach(point => {
        try {
            ctx.beginPath();
            let size = Math.max(2, 6 + Math.round(8 / point.l * point.z));
            ctx.arc(point.x + canvas.width / 2, point.y + canvas.height / 2, size, 0, 2 * Math.PI,);
            ctx.fillStyle = point.colour;
            ctx.fill();
        } catch (e) {
            console.log("Z spiked outside of range")
        }
    });
}

function drawlines(lines, canvas, ctx) {


    lines.forEach(line => {
        line = JSON.parse(line);

        ctx.beginPath();
        let gradient = ctx.createLinearGradient(
            line[0].x + canvas.width / 2,
            line[0].y + canvas.height / 2,
            line[1].x + canvas.width / 2,
            line[1].y + canvas.height / 2
        );
        gradient.addColorStop(0, line[0].colour);
        // gradient.addColorStop(0.5, drawing);
        gradient.addColorStop(1, line[1].colour);
        ctx.strokeStyle = gradient;

        if (line[0].z > 0 && line[1].z > 0) {
            ctx.lineWidth = 3.5;
        } else if (line[0].z < 0 && line[1].z < 0) {
            ctx.lineWidth = 2;
        } else {
            ctx.lineWidth = 2.75;
        }
        ctx.moveTo(line[0].x + canvas.width / 2, line[0].y + canvas.height / 2);
        ctx.lineTo(line[1].x + canvas.width / 2, line[1].y + canvas.height / 2);

        ctx.stroke();
    });

}

function rotate_x(point, n) {
    n %= 360;
    return new Point(
        point.l,
        point.colour,
        point.x,
        Math.cos(n) * point.y - Math.sin(n) * point.z,
        Math.sin(n) * point.y + Math.cos(n) * point.z
    );
}

function rotate_y(point, n) {
    n %= 360;
    return new Point(
        point.l,
        point.colour,
        Math.cos(n) * point.x - Math.sin(n) * point.z,
        point.y,
        Math.sin(n) * point.x + Math.cos(n) * point.z
    );
}

function rotate_z(point, n) {
    n %= 360;
    return new Point(
        point.l,
        point.colour,
        Math.cos(n) * point.x - Math.sin(n) * point.y,
        Math.sin(n) * point.x + Math.cos(n) * point.y,
        point.z
    );
}

function dist(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
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
                points.push(new Point(Math.min(canvas.height, canvas.width), drawing).generateRandom());
            }

            let rotation = 0;
            let colourshift = 0;

            function draw() {
                requestAnimationFrame(draw);
                freqanalyser.getByteFrequencyData(dataArray);

                ctx.fillStyle = background;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                let vispoints = [];
                for (let i = 0; i < bufferLength; i++) {
                    let offsp = points[i].offset(dataArray[i]);
                    let rotp = rotate_x(rotate_y(rotate_z(offsp, rotation), rotation), rotation);
                    rotp.colour = customColour((i + colourshift) / bufferLength);
                    vispoints.push(rotp);
                }
                colourshift += 0.1;
                colourshift %= bufferLength;

                // depth sort points
                vispoints.sort((a, b) => a.z - b.z);

                rotation += rotation_speed;

                let lines = new Set();

                vispoints.forEach(p => {
                    let closest = [];
                    vispoints.forEach(p2 => {
                        let closepoint = new Point(p2.l, p2.colour, p2.x, p2.y, p2.z);
                        closepoint.distance = dist(p, p2);
                        closest.push(closepoint);
                    });

                    closest.sort((a, b) => (a.distance - b.distance)).slice(1, 8).forEach(selected => {
                        lines.add(new Line(p, selected).toString());
                    });

                    // drawline(p, selected, canvas, ctx);
                    // drawPoint(p, canvas, ctx);
                });

                drawlines(lines, canvas, ctx);
                drawpoints(vispoints, canvas, ctx);
            }

            draw();
        });
};