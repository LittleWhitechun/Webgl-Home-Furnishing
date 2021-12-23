/**
 * Created by wx1224 on 2016/8/29.
 */

var container = document.getElementById('canvasId');
var menu = document.getElementById('menu');

/*显示菜单*/
function showMenu(event) {
    // 阻止默认的浏览器右键菜单的弹出
    event.preventDefault();
    menu.style.left = event.pageX + "px";
    menu.style.top = event.pageY+ "px";
    /*设置菜单可见*/
    menu.style.visibility = "visible";
}

/*隐藏菜单*/
function hideMenu() {
    menu.style.visibility = 'hidden';
}

window.onload = function() {
    container.addEventListener("contextmenu", showMenu, false);
    document.body.addEventListener("click", hideMenu);
}

var canvas;
var context;
var background;
var paint = false;
var mouseX;//实时反映鼠标位置
var mouseY;
var back = false;
var redo = false;
var finish = false;
var moving = false;
var drawType;
var roomX;
var roomY;
var doorC = "#00ff00";
var windC = "#ff0000";
var lineC = "#000000";
//坐标数组
var temp = new Array();
var line = new Array();
var Rec = new Array();
var door = new Array();
var wind = new Array();
var start = false;//moving的时候有无鼠标追踪
var offWall = false;//判断门窗是否在墙上
//房间的数据，大小
var modelRoom = new Array();
var modelData = new Array();
var modelSize = new Array();
var modelDoor = new Array();
var modelWind = new Array();
var mouseDist = 3;
var doorDist = 20;//画图时，允许的误差范围
var kdist = Math.PI/6;//判断时，允许的斜率误差范围
var w = new Array();
var bg = new Image();
var meter = 1;//一方格代表几米
var GRID = 35;//一方格像素
function preCanvas() {

    container.addEventListener("contextmenu", showMenu, false);
    document.body.addEventListener("click", hideMenu);

    canvas = document.getElementById('canvasId');
    context = canvas.getContext('2d');
    redraw();
    //画墙，直线
    $('#wallId').mouseup(function(e){ 
        finish = false;
        drawType = 'drawLine';
        redraw();
    });
    //画房间，矩形
    $('#roomId').mouseup(function (e) {
        finish = false;
        drawType = 'drawRec';
        redraw();
    });
    $("#doorId").mouseup(function (e) {
        finish = false;
        drawType = 'drawDoor';
        redraw();
    });
    $("#windowId").mouseup(function(e){
        finish = false;
        drawType = 'drawWind';
        redraw();
    });
    //添加鼠标事件
    $('#canvasId').mousedown(function (e) {
        // finish = false;完成以后不会再画，除非redo
        back = false;
        mouseX = e.pageX - this.offsetLeft -mouseDist;
        mouseY = e.pageY - this.offsetTop -mouseDist;
        if(e.button==0&&!finish){
            temp = [mouseX,mouseY];
            var c = new Array();
            switch (drawType){
                case 'drawDoor':
                    c = check1(temp);
                    if(c!=undefined&&check2(door,c)){
                        door.push(c);
                    }else if(!finish){
                        alert('请在正确的位置绘制门');
                    }
                    break;
                case 'drawWind':
                    c = check1(temp);
                    if(c!=undefined&&check2(wind,c)){
                        wind.push(c);
                    }else if(!finish){
                        alert('请在正确的位置绘制窗户');
                    }
                    break;
                case 'drawLine':
                    window.console.log('mouse down ::'+mouseX+','+mouseY);
                    line.push(temp);
                    break;
                case 'drawRec':
                    Rec.push(temp);
                    break;
                default:
                    //drawModel do nothing.
                    break;
            }
            redraw();
        }
    });

    $('#canvasId').mousemove(function (e) {
        mouseX = e.pageX - this.offsetLeft - mouseDist;
        mouseY = e.pageY - this.offsetTop - mouseDist;
        redraw();
    });

    $('#canvasId').mouseup(function (e) {
        mouseX = e.pageX - this.offsetLeft - mouseDist;
        mouseY = e.pageY - this.offsetTop - mouseDist;
        //实现鼠标右键的功能
        if(e.button==2){
            window.console.log('22222');
            var n=0;
            $('#back').mouseup(function(e){
                n+=1;//避免后退次数累加导致删除元素个数累加
                if(n>1)
                    return;
                switch (drawType){
                    case 'drawLine':
                        line.pop();
                        line.pop();
                        break;
                    case 'drawRec':
                        Rec.pop();
                        Rec.pop();
                        break;
                    case 'drawDoor':
                        door.pop();
                        door.pop();
                        break;
                    case 'drawWind':
                        wind.pop();
                        wind.pop();
                        break;
                    default:
                        break;
                }
                moving = false;
            });
            $('#redo').mouseup(function(e){
                window.console.log('redo');
                finish = false;
                line = [];
                Rec = [];
                door = [];
                wind = [];
            });
            $('#finish').mouseup(function(e){
                window.console.log('finish');
                finish = true;
                paint = false;
                moving = false;
                //房间长度提醒，仅限于一个房间
                switch (drawType){
                    case 'drawLine':
                        if(line.length>1){
                            roomX = line[1][0]-line[0][0];
                            roomY = line[1][1]-line[0][1];
                            //房间大小
                            showSize(roomX,roomY);
                        }
                        break;
                    case 'drawRec':
                        if(Rec.length>1){
                            roomX =Rec[1][0]-Rec[0][0];
                            roomY =Rec[1][1]-Rec[0][1];
                            //房间大小
                            showSize(roomX,roomY);
                        }
                        break;
                    default:
                        break;
                }

            });
        }
    });


    $('#canvasId').mouseleave(function(e){
        moving = false;
        paint = false;
    });

    function redraw() {
        clearCanvas();
        //画背景网格
        var k=0;
        context.beginPath();
        for(;k<800;k+=GRID){
            context.moveTo(k,0);
            context.lineTo(k,500);
            context.strokeStyle = "#C2C2C2";
            context.lineWidth = 0.4;
            context.stroke();
        }
        var m=0;
        context.beginPath();
        for(;m<500;m+=GRID){
            context.moveTo(0,m);
            context.lineTo(800,m);
            context.stroke();
        }

        //画户型
        if(drawType=='drawModel'){
            drawLine(modelData,lineC,3);
            drawLine(modelDoor,doorC,6);
            drawLine(modelWind,windC,6);
            showSize(modelSize[0],modelSize[1]);
        }else{
            drawRec(Rec);
            drawLine(line,lineC,3);
            drawLine(door,doorC,6);
            drawLine(wind,windC,6);
        }
    }
    //监测鼠标事件，选择户型
    function chose(num){
        console.log(modelRoom[0]);
        modelData=modelRoom[num].data;
        modelSize=modelRoom[num].size;
        modelDoor=modelRoom[num].door;
        modelWind=modelRoom[num].wind;
        drawType = 'drawModel';
        redraw();
    }
    $('#room_0').mouseup(function (e) {
        chose(0);
    });
    $('#room_1').mouseup(function(e){
        chose(1);
    });
    $('#room_2').mouseup(function(e){
        chose(2);
    });
    $('#room_3').mouseup(function(e){
        chose(3);
    });
    $('#room_4').mouseup(function(e){
        chose(4);
    });
    $('#room_5').mouseup(function(e){
        chose(5);
    });
}

//显示房间大小,显示像素
function showSize(a,b) {
    $("#x").empty();
    $("#y").empty();
    $("#m2").empty();
    $("#x").append("长："+Math.abs(a));
    $("#y").append("宽："+Math.abs(b));
    $("#m2").append("面积："+Math.abs(a*b));
}
function drawLine(line,color,width){
    if(line.length%2==0){
        context.beginPath();
        context.strokeStyle=color;
        context.lineWidth = width;
        var i=0;
        for(;i<line.length;i+=2){
            context.moveTo(line[i+1][0],line[i+1][1]);
            context.lineTo(line[i][0],line[i][1]);
            context.closePath();
            context.stroke();
        }
    }else if(line.length%2==1){
        context.beginPath();
        context.strokeStyle= color;
        context.lineWidth = width;
        var i=0;
        for(;i<line.length-1;i+=2){
            context.moveTo(line[i+1][0],line[i+1][1]);
            context.lineTo(line[i][0],line[i][1]);
            context.closePath();
            context.stroke();
        }
        context.beginPath();
        context.moveTo(mouseX,mouseY);
        context.lineTo(line[line.length-1][0],line[line.length-1][1]);
        context.lineWidth= width;
        context.strokeStyle= color;
        context.closePath();
        context.stroke();
    }
}


function drawRec(Rec){
    if(Rec.length%2==0){
        var i=0;
        context.beginPath();
        context.strokeStyle="#000000";
        context.lineWidth=3;
        for(;i<Rec.length;i+=2){
            var w = Rec[i+1][0]-Rec[i][0];
            var h = Rec[i+1][1]-Rec[i][1];
            context.rect(Rec[i][0],Rec[i][1],w,h);
            context.stroke();
        }
    }else if(Rec.length%2==1){
        var i=0;
        context.beginPath();
        context.strokeStyle="#000000";
        context.lineWidth=3;
        for(;i<Rec.length-1;i+=2){
            var w = Rec[i+1][0]-Rec[i][0];
            var h = Rec[i+1][1]-Rec[i][1];
            context.rect(Rec[i][0],Rec[i][1],w,h);
            context.stroke();
        }
        context.beginPath();
        context.lineWidth=3;
        context.strokeStyle="#000000";
        var w = mouseX-Rec[Rec.length-1][0];
        var h = mouseY-Rec[Rec.length-1][1];
        context.rect(Rec[Rec.length-1][0],Rec[Rec.length-1][1],w,h);
        context.stroke();
    }
}

// 判断门窗是否在墙上，判断墙是否连接，判断墙是否可绘
//check0判断门窗重叠
function check0(point) {
    var dw = new Array();
    dw = dw.concat(door);
    dw = dw.concat(wind);
    var x = point[0];
    var y = point[1];
    var i=0;
    var len;
    if(dw.length<2){
        return;
    }

    if(dw.length%2==0){
        len = dw.length;
    }else{
        len = dw.length-1;
    }

    for(;i<len;i+=2){
        var x1 = dw[i][0];
        var y1 = dw[i][1];
        var x2 = dw[i+1][0];
        var y2 = dw[i+1][1];
        if(x2!=x1&&y2!=y1){
            var k = (y2-y1)/(x2-x1);
            var b = y1-k*x1;
            var dist = Math.abs(k*x+b-y)/Math.sqrt(1+k*k);//点到直线的距离
            if(dist<doorDist&&y<Math.max(y1,y2)&&y>Math.min(y1,y2)){
                return 1;
            }
        }else if(x2==x1&&y1!=y2){
            var dist = Math.abs(x-x1);
            if(dist<doorDist&&y<Math.max(y1,y2)&&y>Math.min(y1,y2)){
                return 1;
            }
        }else if(y1==y2&&x1!=x2){
            var dist = Math.abs(y-y1);
            if(dist<doorDist&&x<Math.max(x1,x2)&&x>Math.min(x1,x2)){
                return 1;
            }
        }
    }
}
//check1判断门窗与墙体是否重叠，第一个点，调用check0判断重叠
function check1(point) {
    var walls = new Array();
    walls = walls.concat(Rec2Line(Rec));
    walls = walls.concat(line);
    window.console.log('walls '+walls);
    var x = point[0];
    var y = point[1];
    var arr = new Array();
    var i=0;
    for(;i<walls.length;i+=2){
        var x1 = walls[i][0];
        var y1 = walls[i][1];
        var x2 = walls[i+1][0];
        var y2 = walls[i+1][1];
        if(x2!=x1&&y2!=y1){
            var k = (y2-y1)/(x2-x1);
            var b = y1-k*x1;
            var dist = Math.abs(k*x+b-y)/Math.sqrt(1+k*k);//点到直线的距离
            var k1 = -1/k;
            var b1 = y-k1*x;
            var crossX = -(b1-b)/(k1-k);
            var crossY = k*crossX+b;
            if(dist<doorDist&&( (y<Math.max(y1,y2)&&y>Math.min(y1,y2)) || (x<Math.max(x1,x2)&&x>Math.min(x1,x2)) )){
                arr = [crossX,crossY];
                if(check0(arr)!=1){
                    w = w.concat(x1,y1,x2,y2);
                    return arr;
                }

            }
        }else if(x2==x1&&y1!=y2){
            var dist = Math.abs(x-x1);
            if(dist<doorDist&&y<Math.max(y1,y2)&&y>Math.min(y1,y2)){
                arr = [x1,y];
                if(check0(arr)!=1) {
                    w = w.concat(x1, y1, x2, y2);
                    return arr;
                }
            }
        }else if(y1==y2&&x1!=x2){
            var dist = Math.abs(y-y1);
            if(dist<doorDist&&x<Math.max(x1,x2)&&x>Math.min(x1,x2)){
                arr = [x,y1];
                if(check0(arr)!=1) {
                    w = w.concat(x1, y1, x2, y2);
                    return arr;
                }
            }
        }
    }
}
//check2判断门窗与墙体是否重叠，第二个点，判断是否在同一面墙上，调用check0判断重叠
function check2(line,c){

    if(line.length%2==1){
        var x = c[0];
        var y = c[1];
        var x1 = w[w.length-8];
        var y1 = w[w.length-7];
        var x2 = w[w.length-6];
        var y2 = w[w.length-5];
        if(x2==x1&&x2==x){
            window.console.log('x::'+x2+","+x1+","+x);
            if(check0(c)!=1){
                return true;
            }

        }else if(y2==y1&&y2==y){
            window.console.log('y::'+y2+","+y1+","+y);
            if(check0(c)!=1) {
                return true;
            }
        }else if((x2-x)*(y2-y1)==(x2-x1)*(y2-y)){
            //适用于水平的线
            if(check0(c)!=1) {
                return true;
            }
        }else if(x2!=x1&&y2!=y1){
            //斜率在一定范围内 把线约束到墙上
            var k1 = Math.abs((x2-x1)/(y2-y1));
            var k2 = Math.abs((x1-x)/(y1-y));
            if(k2<k1+kdist&&k2>k1-kdist||k1==k2){
                if(check0(c)!=1) {
                    return true;
                }
            }
        }
        w.pop();
        w.pop();
        w.pop();
        w.pop();
        return false;
    }else{
        window.console.log('check2 even::'+line.length);
        if(check0(c)!=1) {
            return true;
        }
    }
}


//把矩形改为直线类型的数组便于判断墙的坐标
function Rec2Line(Rec){
    var i=0;
    var newLine = new Array();
    for(;i<Rec.length;i+=2){
        newLine.push(Rec[i]);
        newLine.push([Rec[i][0],Rec[i+1][1]]);
        newLine.push([Rec[i][0],Rec[i+1][1]]);
        newLine.push(Rec[i+1]);
        newLine.push(Rec[i+1]);
        newLine.push([Rec[i+1][0],Rec[i][1]]);
        newLine.push([Rec[i+1][0],Rec[i][1]]);
        newLine.push(Rec[i])
    }
    return newLine;
}
function clearCanvas()
{
    context.clearRect(0, 0, canvas.width, canvas.height);
}

//加载JSON文件
function loadJSON(){
    $.get("modelRoom.json",function(data,status){
        modelRoom[0] = data.room_0;
        modelRoom[1] = data.room_1;
        modelRoom[2] = data.room_2;
        modelRoom[3] = data.room_3;
        modelRoom[4] = data.room_4;
        modelRoom[5] = data.room_5;
        console.log("数据: " + data + "\n状态: " + status)
        alert("数据: " + data + "\n状态: " + status);
    });
}

function getInfo()
{
    var next_var = {
        "data":[],
        "wind":[],
        "door":[],
    };

    //进入3D界面，传输的数据
    $("#next").click(function(){
        //进入3D界面，整理坐标
        var nextData = new Array();
        var nextDoor = new Array();
        var nextWind = new Array();
        
        if(drawType=='drawModel'){
            nextData = modelData;
            nextDoor = modelDoor;
            nextWind = modelWind;
        }else{
            nextData = Rec2Line(Rec);
            nextData = nextData.concat(line);
            if(nextData.length==0){//如果没有绘制户型直接进入3D界面，默认户型1
                nextData = modelRoom[0].data;
                nextWind = modelRoom[0].wind;
                nextDoor = modelRoom[0].door;
            }else{
                nextDoor = door;
                nextWind = wind;
            }
        }

        next_var.data = nextData;//墙的坐标，直线端点
        next_var.wind = nextWind;//窗户坐标，直线端点
        next_var.door = nextDoor;//门的坐标，直线端点

'}';

        var jsonstr = JSON.stringify(next_var);
        sessionStorage.walldesign = jsonstr;
    });
}
loadJSON();
preCanvas();
getInfo();
