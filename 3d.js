const rotation_speed = 0.006;
const fft = 128; // needs to be power of 2, represents 2 * n points
const edge = 0.6; // border blank for expansion
const drawing = 'rgba(255, 255, 255, 0.7)';
const background = "#43a2be";

function createPoint(l) {
    l = edge * l;
    return {
        x: Math.round(Math.random() * l - l / 2),
        y: Math.round(Math.random() * l - l / 2),
        z: Math.round(Math.random() * l - l / 2),
        depth: l,
        offset: function (o) {
            let magnitude = Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2) + Math.pow(this.z, 2));
            let norm = {x: this.x / magnitude, y: this.y / magnitude, z: this.z / magnitude};
            return {
                x: Math.round(this.x + (norm.x * o)),
                y: Math.round(this.y + (norm.y * o)),
                z: Math.round(this.z + (norm.z * o)),
                depth: this.depth
            };
        }
    };
}

function drawPoint(point, canvas, ctx) {
    try{
        ctx.beginPath();
        let size = Math.max(2, 6 + Math.round(8 / point.depth * point.z));
        ctx.arc(point.x + canvas.width / 2, point.y + canvas.height / 2, size, 0, 2 * Math.PI,);
        ctx.fillStyle = drawing;
        ctx.fill();
    }
    catch (e) {
        console.log("Z spiked outside of range")
    }
}

function drawline(point, selected, canvas, ctx) {
    ctx.beginPath();
    ctx.strokeStyle = drawing;

    selected.forEach(line => {
        if(point.z > 0 && line.z > 0){
            ctx.lineWidth = 3.5;
        }else if(point.z < 0 && line.z < 0){
            ctx.lineWidth = 2;
        }else{
            ctx.lineWidth = 2.75;
        }
        ctx.moveTo(point.x + canvas.width / 2, point.y + canvas.height / 2);
        ctx.lineTo(line.x + canvas.width / 2, line.y + canvas.height / 2);
    });

    ctx.stroke();
}

function rotate_x(point, n){
    n %= 360;
    return {
        x: point.x,
        y: Math.cos(n) * point.y - Math.sin(n) * point.z,
        z: Math.sin(n) * point.y + Math.cos(n) * point.z,
        depth: point.depth
    };
}

function rotate_y(point, n) {
    n %= 360;
    return {
        x: Math.cos(n) * point.x - Math.sin(n) * point.z,
        y: point.y,
        z: Math.sin(n) * point.x + Math.cos(n) * point.z,
        depth: point.depth
    };
}

function rotate_z(point, n){
    n %= 360;
    return {
        x: Math.cos(n) * point.x - Math.sin(n) * point.y,
        y: Math.sin(n) * point.x + Math.cos(n) * point.y,
        z: point.z,
        depth: point.depth
    };
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
                points.push(createPoint(Math.min(canvas.height, canvas.width)));
            }

            let rotation = 0;

            function draw() {
                requestAnimationFrame(draw);
                freqanalyser.getByteFrequencyData(dataArray);

                ctx.fillStyle = background;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                let vispoints = [];
                for (let i = 0; i < bufferLength; i++) {
                    let offsp = points[i].offset(dataArray[i]);
                    let rotp = rotate_x(rotate_y(rotate_z(offsp, rotation), rotation), rotation);
                    vispoints.push(rotp);
                }

                rotation += rotation_speed;

                vispoints.forEach(p => {
                    let closest = [];
                    vispoints.forEach(p2 => {
                        closest.push({d: dist(p, p2), x: p2.x, y: p2.y, z: p2.z});
                    });

                    let selected = closest.sort((a, b) => (a.d - b.d)).slice(1, 8);

                    drawline(p, selected, canvas, ctx);
                    drawPoint(p, canvas, ctx);
                });
            }
            draw();
        });
};