//固定画布的宽高
var canvaswidth=900;
var canvasheight=600;

//记录各个墙和门窗的id
var WallCount=0;
var spCount=0;

//默认墙纸
var wallURL='images/materials/gray50.jpg';
//默认地板
var floorURL='https://cdn.aframe.io/a-painter/images/floor.jpg';
//默认窗户
var WindowURL='images/window/win4';
var DoorURL='images/door/door5';

//vr的比例
var VR_SCALE=0.05;
//用于记录各个模型的ID
var IDCount=0;
// 是否使用测试场景

var DEBUG_TEXT_MAX_NUMBER = 5;

//通过DEBUG_ON_OFF的切换，决定当前是否是DEBUG模式(FPS等参数数据的显示)
var DEBUG_ON_OFF = false;
var THREE = window.THREE;

// 用于调试输出，控制div标签的id="debug_text"
var debug_text_number = 0;
var debug_text_content = [];

// 是否使用测试场景
var USING_DEBUGGING_SCENE = false;

function showmesg(text, printTrace, stopRunning) {
    "use strict";
    if (!DEBUG_ON_OFF) {
        return;
    }
    window.console.log(text);
    debug_text_number++;
    // 数组方法push()和shift()分别是队列的enqueue()与dequeue()方法
    debug_text_content.push(text);
    if (debug_text_number > DEBUG_TEXT_MAX_NUMBER) {
        debug_text_content.shift();
    }
    var debug_text = document.getElementById('debug_text');
    debug_text.height = hRender.getCanvasHeight();
    // join也是一种数组方法，用于合成为一个字符串，并插入指定的分隔符
    debug_text.innerHTML = debug_text_content.join('<br/>');
    // 打印调用栈
    if (printTrace === true) {
        try {
            if (stopRunning === true) {
                throw new Error();
            } else {
                throw new Error('一般错误：' + text);
            }
        }
        catch (e) {
            if (stopRunning === true) {
                throw new Error('严重错误：' + text + '\n' + e.stack);
            } else {
                window.console.error(e.stack);
            }
        }
    }
}


//光线投射
var rayCaster;
// 指定要更改设置的对象，对象的修改代码位于各个JSON文件中
var SELECTED_FOR_SETTING;

// 渲染使用的表面材质类型
var MATERIAL_TYPE = {
    PHONG: 0,
    LAMBERT: 1
};

// 房间的参数
var room = {
    N_S_length: 20,
    E_W_length: 20,
    height: 60,              // 房间的高度
    windowTop: 50,           // 窗户的底边高度
    windowBottom: 15,        // 窗户的顶边高度
    doorTop: 50,             // 门的高度
    initialX: 1,
    initialZ: 1
};



// _____________________
// 模块：弹出提示popup
// _____________________

var popup = function() {    // open IIFE
    "use strict";

    // private attributes and methods
    var jq;
    var self;

    // 是否显示页面弹出提示
    var handle;

    // public attributes and methods
    var publicSet = {
        // 在弹出提示中显示指定的文本
        showPopup: function(text) {
            if (popup) {
                clearTimeout(popup);
            }
            jq.html(text);
            jq.fadeIn(200);
            handle = setTimeout(self.hidePopup, 2000);
        },
        // 隐藏弹出提示
        hidePopup: function () {
            jq.fadeOut(200);
            handle = null;
        },
        initialize: function () {
            jq = $('#popup_text');
            self = window.popup;
        },
        getJQueryObject: function () {
            return jq;
        }
    };

    return publicSet;
}();    // close IIFE
popup.initialize();


// _________________
// 模块：辅助工具
// _________________

var hTools = function(){
    "use strict";

    // 用于显示帧速率
    var lastFrameCount = 0;
    var frameCount = 0;
    var FPSHandle = null;

    // public attributes and methods
    var publicSet = {
        // 弧度转角度
        radians2degrees: function (radians) {
            return (radians / Math.PI * 180);
        },
        // 角度转弧度
        degrees2radians: function (degrees) {
            return (degrees / 180 * Math.PI);
        },
        ONE_DEGREE_IN_RADIANS: null,
        // roundTo()：四舍五入到指定小数位数precision
        roundTo: function (value, precision) {
            var i;
            if (typeof value !== 'number') {
                value = parseFloat(value);
            }
            for (i = 0; i < precision; i++) {
                value *= 10;
            }
            value = Math.round(value);
            for (i = 0; i < precision; i++) {
                value /= 10;
            }
            return value;
        },
        // FPS()：显示帧速率
        FPS: function () {
            if (!DEBUG_ON_OFF) {
                return;
            }
            var curDate = new Date();
            showmesg(curDate.getHours() + ":" + curDate.getMinutes() + ":" + curDate.getSeconds() +
                " : " + (frameCount - lastFrameCount) + 'FPS');
            lastFrameCount = frameCount;
            if (FPSHandle !== null) {
                window.clearInterval(FPSHandle);
            }
            FPSHandle = window.setTimeout(hTools.FPS, 1000);
        },
        // countFrame()：统计帧速率
        countFrame: function () {
            frameCount++;
        },
        DOM_Handle: {
            CANVAS: document.getElementById('canvas'),
            LEFT_PANEL: document.getElementById('canvas'),
            RIGHT_PANEL: document.getElementById('left_panel')
        }
    };

    (function initialize() {
        publicSet.ONE_DEGREE_IN_RADIANS = publicSet.degrees2radians(1);
    })();

    return publicSet;
}();



// ------------------
// 模块：处理物体
// ------------------


var hDoObj = function() {
    "use strict";

    // 放大系数
    var ZOOM_IN_FACTOR = 1.0400;
    // 禁止缩放的对象列表
    var TYPE_BANNED_TO_ZOOM = null;
    var TYPE_BANNED_TO_MOVE = null;
    var TYPE_BANNED_TO_DELETE = null;

    // canZoom()：判断是否可以缩放
    function canZoom(object3d) {
        var i;
        var ret = true;
        for (i = 0; i < TYPE_BANNED_TO_ZOOM.length; i++) {
            if (object3d.typename === TYPE_BANNED_TO_ZOOM[i]) {
                ret = false;
            }
        }
        return ret;
    }

    // 执行缩放
    function zoom(factor) {
        if (INTERSECTED && canZoom(INTERSECTED)) {
            // 如果缩放因子没有定义，需要先定义
            if (!INTERSECTED.scaleFactor) {
                INTERSECTED.scaleFactor = 1;
            }
            // 在乘以新的缩放因子以前，先清除旧的缩放因子的影响。
            INTERSECTED.scale.multiplyScalar(1 / INTERSECTED.scaleFactor);
            INTERSECTED.scaleFactor *= factor;
            INTERSECTED.scale.multiplyScalar(INTERSECTED.scaleFactor);
        }
    }

    // public attributes and methods
    var publicSet = {
        // 标准化物体名称
        TYPE_FRIENDLY_NAME: {
            BASIC: 'Basic Shape (ONLY FOR TEST)',
            LIGHT_GROUP: 'Light Group',
            LIGHT_SPHERE: 'Light Sphere',
            LIGHT_HELPER: 'Light Helper',
            LIGHT_TARGET: 'Light Target',
            BACKGROUND: 'Background Image',
            SURFACE_PLANE: 'surfaceplane',
            FLOOR: 'floor',
            CEILING: 'Ceiling',
            WALL: 'wall',
            WINDOW: 'Furnishing: Window',
            DOOR: 'Furnishing: Door',
            DESK: 'Furnishing: Desk',
            Elec:'Furnishing:Elec',
            Lamp:'Furnishing:Lamp'
        },
        // 标准化文件名
        TYPE_FILE_NAME: {
            BASIC: 'basic',
            WINDOW: 'window',
            DOOR: 'door'
        },

        // zoomIn()：放大选定的对象
        zoomIn: function () {
            zoom(ZOOM_IN_FACTOR);
        },
        // zoomOut()：缩小选定的对象
        zoomOut: function () {
            zoom(1 / ZOOM_IN_FACTOR);
        },

        // 判断鼠标下方的对象是否可以移动
        canMove: function (object3d) {
            var i;
            var ret = true;
            for (i = 0; i < TYPE_BANNED_TO_MOVE.length; i++) {
                if (object3d.typename === TYPE_BANNED_TO_MOVE[i]) {
                    ret = false;
                }
            }
            return ret;
        },

        // 判断鼠标下方的对象是否可以删除
        canDelete: function (object3d) {
            var i;
            var ret = true;
            for (i = 0; i < TYPE_BANNED_TO_DELETE.length; i++) {
                if (object3d.typename === TYPE_BANNED_TO_DELETE[i]) {
                    ret = false;
                    break;
                }
            }
            return ret;
        }

    };

    (function initialize() {
        TYPE_BANNED_TO_ZOOM = [
            publicSet.TYPE_FRIENDLY_NAME.FLOOR,
            publicSet.TYPE_FRIENDLY_NAME.CEILING,
            publicSet.TYPE_FRIENDLY_NAME.WALL,
            publicSet.TYPE_FRIENDLY_NAME.LIGHT_SPHERE,
            publicSet.TYPE_FRIENDLY_NAME.LIGHT_HELPER,
            publicSet.TYPE_FRIENDLY_NAME.BACKGROUND,
            publicSet.TYPE_FRIENDLY_NAME.DOOR,
            publicSet.TYPE_FRIENDLY_NAME.WINDOW,
            publicSet.TYPE_FRIENDLY_NAME.SURFACE_PLANE
        ];
        TYPE_BANNED_TO_MOVE = [
            publicSet.TYPE_FRIENDLY_NAME.FLOOR,
            publicSet.TYPE_FRIENDLY_NAME.CEILING,
            publicSet.TYPE_FRIENDLY_NAME.WALL,
            publicSet.TYPE_FRIENDLY_NAME.LIGHT_HELPER,
            publicSet.TYPE_FRIENDLY_NAME.BACKGROUND,
            publicSet.TYPE_FRIENDLY_NAME.DOOR,
            publicSet.TYPE_FRIENDLY_NAME.WINDOW
        ];
        TYPE_BANNED_TO_DELETE = [
            publicSet.TYPE_FRIENDLY_NAME.FLOOR,
            publicSet.TYPE_FRIENDLY_NAME.WALL,
            publicSet.TYPE_FRIENDLY_NAME.CEILING,
            publicSet.TYPE_FRIENDLY_NAME.LIGHT_HELPER,
            publicSet.TYPE_FRIENDLY_NAME.BACKGROUND,
            publicSet.TYPE_FRIENDLY_NAME.DOOR,
            publicSet.TYPE_FRIENDLY_NAME.WINDOW
        ];
    }());

    return publicSet;
}();




// -------------
// 模块:事件处理
// -------------

var hEvent = function () {  // open IIFE
    "use strict";

    // private attributes and methods
    // 用于检测鼠标单击事件click
    var mouseCoordsMouseDown = new THREE.Vector2();
    var mouseCoordsMouseUp = new THREE.Vector2();
    var CLICK_TIME_OUT = 500;
    // 判定为鼠标单击事件的最大拖动半径范围
    var MAX_MOVE_RADUIS = 9;
    var SQUARE_OF_MAX_MOVE_RADUIS = 0;
    // 鼠标是否移动到了右侧面板
    var MOUSE_ON_RIGHT_PANEL = false;

    // public attributes and methods
    var publicSet = {
        // 记录鼠标的位置：当鼠标移动时，更新mousePosition的值，以便计算选中的对象。该二维向量的含义见onmousemove函数内部的说明。
        mousePosition: new THREE.Vector2(),
        // 用于检测鼠标单击事件click
        isClickTimeOut: false,

        // 检测是否出现了鼠标的过度拖动
        objectCoordsMouseDown: new THREE.Vector3(),
        keyDown: function(event) {
            var keyCode = parseInt(event.keyCode);
            if (keyCode >= 'A'.charCodeAt(0) && keyCode <= 'Z'.charCodeAt(0)) {
                switch (keyCode) {
                    case 'C'.charCodeAt(0):
                        // C：循环切换相机视角
                        hCamera.nextType();
                        break;
                    case 'P'.charCodeAt(0):
                        // P：控制动画播放
                        hRender.playAnimation = !hRender.playAnimation;
                        break;
                }
            } else {
                if (37 <= keyCode && keyCode <= 40) {
                    hCamera.KeyEventsHandler(keyCode);
                }
                if (keyCode === 46) {
                    // Delete: 删除选定的对象
                    hRayCasting.deleteObjectFromScene();
                }
            }
        },
        mouseMove_leftPanel: function(event) {
            event.preventDefault();

            MOUSE_ON_RIGHT_PANEL = false;
            var x = ( event.offsetX / canvaswidth ) * 2 - 1;
            var y = -( event.offsetY / canvasheight ) * 2 + 1;
            hEvent.mousePosition.set(x, y);

        },
        // 如果鼠标移动到了左侧面板，取消当前已有的任何选择
        mouseMove_rightPanel: function(event) {
            MOUSE_ON_RIGHT_PANEL = true;
            hRayCasting.deleteSelecting();
        },
        isMouseOnRightPanel: function() {
            return MOUSE_ON_RIGHT_PANEL;
        },
        // 重要提醒：在已经定义了onmousedown、onmouseup事件的情况下，应避免再定义事件onclick，否则会出现难以理解的事情！
        mouseClick: function() {
            var location;
            if (INTERSECTED) {
                if (isSupportingFace(INTERSECTED)) {
                    window.console.log('click a face');
                    // 可选中的对象是一个支撑面，对于支撑面，可以向支撑面上添加对象或者修改支撑面的属性
                    if (SELECT_IN_MENU) {
                        // 如果已经在菜单中选择了一种对象，就向支撑面上添加对象
                        // INTERSECTED是支撑面，则可以向这个支撑面上添加一个已经选定的对象
                        window.console.log(SELECT_IN_MENU.typename);
                        addObjectInMenu(INTERSECTED);
                    } else {
                        // var curPlane = new THREE.Plane();
                        // generateMathPlane(INTERSECTED, curPlane);
                        // var intersectionPoint = new THREE.Vector3();
                        // if (rayCaster.ray.intersectPlane(curPlane, intersectionPoint)) {
                        //     createSurfacePlane(INTERSECTED, intersectionPoint);
                        // }
                        // 设置属性的过程中，实际上用到了侧边面板，因此需要先隐藏光源
                        if (INTERSECTED.typename !== hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP) {
                            hLight.hideAllLightHelper();
                        }
                        // 如果没有从菜单中选择对象，则切换到选择项的设置页面
                        SELECTED_FOR_SETTING = INTERSECTED;
                        console.log('被选中了！！！！');
                        switch (INTERSECTED.typename) {
                            case hDoObj.TYPE_FRIENDLY_NAME.FLOOR:
                                loadModifyPlane('floor');
                                break;
                            case hDoObj.TYPE_FRIENDLY_NAME.CEILING:
                                loadModifyPlane('ceiling');
                                break;
                            case hDoObj.TYPE_FRIENDLY_NAME.WALL:
                                loadModifyPlane('wall');
                                break;
                        }
                    }
                } else {
                    // 设置属性的过程中，实际上用到了侧边面板，因此需要先隐藏光源
                    if (INTERSECTED.typename !== hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP) {
                        hLight.hideAllLightHelper();
                    }
                    // 可选中的对象不是支撑面，即INTERSECTED不是支撑面，则可以设置这个支撑面的相关属性
                    SELECTED_FOR_SETTING = INTERSECTED;
                    switch (INTERSECTED.typename) {
                        case 'bed':
                        case 'sofa':
                        case 'refrigerator':
                        case 'bookcase':
                        case 'desk':
                        case "elec":
                        case "lamp":
                            location = 'json/pagedata/obj-modify.json';
                            $.get(location, function (data, status) {
                                if (status === 'success') {
                                    popup.showPopup('选中了家具');
                                } else {
                                    showmesg('获取JSON文件(' + location + ')失败', true);
                                }
                                parseSidePanelPageData(data,'right');
                            });
                            break;
                        case hDoObj.TYPE_FRIENDLY_NAME.WINDOW:
                            location = 'json/pagedata/window-modify.json';
                            $.get(location, function (data, status) {
                                if (status === 'success') {
                                    popup.showPopup('选中了窗户');
                                } else {
                                    showmesg('获取JSON文件(' + location + ')失败', true);
                                }
                                parseSidePanelPageData(data,'right');
                            });
                            break;
                        case hDoObj.TYPE_FRIENDLY_NAME.DOOR:
                            location = 'json/pagedata/door-modify.json';
                            $.get(location, function (data, status) {
                                if (status === 'success') {
                                    popup.showPopup('选中了门');
                                } else {
                                    showmesg('获取JSON文件(' + location + ')失败', true);
                                }
                                parseSidePanelPageData(data,'right');
                            });
                            break;
                        case hDoObj.TYPE_FRIENDLY_NAME.SURFACE_PLANE:
                            location = 'json/pagedata/surfaceplane-modify.json';
                            $.get(location, function (data, status) {
                                if (status === 'success') {
                                    popup.showPopup('选中了挂饰');
                                } else {
                                    showmesg('获取JSON文件(' + location + ')失败', true);
                                }
                                parseSidePanelPageData(data,'right');
                            });
                            break;
                        default:
                            break;
                    }
                }
            }
        },
        mouseDown: function(event) {
            event.preventDefault();
            if (INTERSECTED && hDoObj.canMove(INTERSECTED)) {
                // 用于选定导入的OBJ模型对象的整体，或者光源的整体
                if (INTERSECTED.parent instanceof THREE.Group) {
                    hRayCasting.SELECTED = INTERSECTED.parent;
                } else {
                    hRayCasting.SELECTED = INTERSECTED;
                }
                // 记录对象的原始位置，用于检测过度拖动
                hEvent.objectCoordsMouseDown.copy(hRayCasting.SELECTED.position);


                console.log('开始测试！！！！');//TODO:修改1
                console.log(INTERSECTED.name+" "+INTERSECTED.position.x*VR_SCALE+"  "+INTERSECTED.position.z*VR_SCALE);//TODO:记录位置等信息、记录id
                console.log(INTERSECTED);
                var mydata={
                    position:INTERSECTED.position.x*VR_SCALE+" 0.5 "+INTERSECTED.position.z*VR_SCALE,
                    type:INTERSECTED.typename
                };
                var realdata=JSON.stringify(mydata);
                sessionStorage.setItem(INTERSECTED.name,realdata);


                // 找出射线与平面的相交位置，这里的平面是所选对象的支撑面
                // 初始化supportingPlane，赋值为new THREE.Plane()是必须的
                var supportingPlane = new THREE.Plane();
                if (isSupportingFace(hRayCasting.SELECTED)) {
                    // 企图移动支撑面
                    showmesg('企图移动支撑面', true);
                    return;
                    // generateMathPlane(hRayCasting.SELECTED, supportingPlane);
                } else {
                    // 企图移动对象，因此根据对象的支撑面去找到这个数学意义上的平面
                    generateMathPlane(hRayCasting.SELECTED.supportingFace, supportingPlane);
                }
                if (rayCaster.ray.intersectPlane(supportingPlane, hRayCasting.intersection)) {
                    hRayCasting.offset.copy(hRayCasting.intersection).sub(hRayCasting.SELECTED.position);
                }
                hTools.DOM_Handle.CANVAS.style.cursor = 'move';
            }

            // 用于检测鼠标单击事件click
            hEvent.isClickTimeOut = false;
            setTimeout(function () {
                hEvent.isClickTimeOut = true;
            }, CLICK_TIME_OUT);
            mouseCoordsMouseDown.set(event.clientX, event.clientY);
        },
        mouseUp: function(event) {
            event.preventDefault();
            if (hRayCasting.SELECTED) {
                // 计算拖动前后的距离之差，防止过度拖动
                if (hEvent.objectCoordsMouseDown.sub(hRayCasting.SELECTED.position).length() > 20 * room.height) {
                    scene.remove(hRayCasting.SELECTED);
                    hRayCasting.SELECTED = null;
                    popup.showPopup('对象被过度拖动，为方便操作，系统将自动删除这个对象。');
                    return;
                }
                // 拖动完成，将hRayCasting.SELECTED置空。
                hRayCasting.SELECTED = null;
            }
            hTools.DOM_Handle.CANVAS.style.cursor = 'auto';
            // 用于检测鼠标单击事件click
            var isClick = false;
            mouseCoordsMouseUp.set(event.clientX, event.clientY);
            if (!hEvent.isClickTimeOut) {
                // var DistanceX = mouseCoordsMouseUp.x - mouseCoordsMouseDown.x;
                // var DistanceY = mouseCoordsMouseUp.y - mouseCoordsMouseDown.y;
                // var squareOfDistance = DistanceX * DistanceX + DistanceY * DistanceY;
                var squareOfDistance = mouseCoordsMouseUp.distanceToSquared(mouseCoordsMouseDown);
                if (squareOfDistance < SQUARE_OF_MAX_MOVE_RADUIS) {
                    isClick = true;
                }
            }
            hEvent.isClickTimeOut = false;
            if (isClick) {
                this.mouseClick();
            }
        },
        // 向上滚动
        ScrolUp: function () {hDoObj.zoomIn();},
        // 向下滚动
        ScrolDown: function () {hDoObj.zoomOut();},
        initialize: function () {
            // 鼠标事件的设置（除了滚轮）
            SQUARE_OF_MAX_MOVE_RADUIS = MAX_MOVE_RADUIS * MAX_MOVE_RADUIS;
            hTools.DOM_Handle.LEFT_PANEL.onmousemove = function (event) {publicSet.mouseMove_leftPanel(event);};
            hTools.DOM_Handle.LEFT_PANEL.onmousedown = function (event) {publicSet.mouseDown(event);};
            hTools.DOM_Handle.LEFT_PANEL.onmouseup = function (event) {publicSet.mouseUp(event);};
            hTools.DOM_Handle.RIGHT_PANEL.onmousemove = function (event){publicSet.mouseMove_rightPanel(event);};

            // 键盘事件的设置
            document.onkeydown = function (event) {publicSet.keyDown(event);};

            // 阻止从选择面板中拖拽，优化UI体验
            hTools.DOM_Handle.RIGHT_PANEL.ondragstart = function () {return false;};

            // 禁止用户选择文本，优化UI体验
            document.onselectstart = function () {return false;};

            // 加载完成之后自动运行的事件设置
            $(document).ready(function () {
                initSidePanel();
                hRender.redraw();
            });

            // 支持鼠标滚轮事件。不同浏览器对于鼠标滚轮事件的支持程度是不同的。
            // http://stackoverflow.com/questions/32711895/how-to-generate-mousewheel-event-in-jquery-javascript
            var canvasJQSelector = $('#canvas');
            // Firefox
            canvasJQSelector.bind('DOMMouseScroll', function (event) {
                if (event.originalEvent.detail > 0) {
                    // 向下滚动
                    hEvent.ScrolDown();
                } else {
                    // 向上滚动
                    hEvent.ScrolUp();
                }
                // 阻止页面滚动
                return false;
            });
            // IE, Opera, Safari
            canvasJQSelector.bind('mousewheel', function (event) {
                if (event.originalEvent.wheelDelta < 0) {
                    // 向下滚动
                    hEvent.ScrolDown();
                } else {
                    // 向上滚动
                    hEvent.ScrolUp();
                }
                // 阻止页面滚动
                return false;
            });
        }
    };

    return publicSet;
}();    // close IIFE
hEvent.initialize();





// ---------
// 模块:光照部分
// -----------

var hLight = function() {
    "use strict";

    // private attributes and methods
    var ambientLightObject = null;
    var directionalLightObject = [];

    // 为了实现真实感渲染，本系统不提供点光源的支持，因为点光源不能够显示阴影。
    var DEFAULT_SPOTLIGHT = {
        posX: 5,
        posY: 6,
        posZ: 5,
        targetPosX: 0,
        targetPosY: -1.01,
        targetPosZ: 0,
        red: 0x88,
        green: 0x88,
        blue: 0x88,
        intensity: 0.5,
        distance: 0,
        angle: Math.PI/3
    };

    var RADIUS_OF_LIGHT_SPHERE = 0.75;
    var WIDTHSEGMENTS_OF_LIGHT_SPHERE = 64;
    var HEIGHTSEGMENTS_OF_LIGHT_SPHERE = 64;
    var COLOR_OF_LIGHT_SPHERE = 0xFF980A;

    // public attributes and methods
    var publicSet = {
        ambientLightParameter: {
            gray: 0x80,
            intensity: 0.8
        },
        // updateAmbientLight()：设置环境光
        updateAmbientLight: function () {
            ambientLightObject.color.r = this.ambientLightParameter.gray/255;
            ambientLightObject.color.g = this.ambientLightParameter.gray/255;
            ambientLightObject.color.b = this.ambientLightParameter.gray/255;
            ambientLightObject.intensity = this.ambientLightParameter.intensity;
        },
        // createAmbientLight()：创建环境光
        createAmbientLight: function() {
            var gray = this.ambientLightParameter.gray;
            var intensity = this.ambientLightParameter.intensity;
            var hexColor = 256 * 256 * gray + 256 * gray + gray;
            // AmbientLight( color, intensity )
            ambientLightObject = new THREE.AmbientLight(hexColor, intensity);
            scene.add(ambientLightObject);
        },

        directionalLightParameter: {
            gray: 0x80,
            intensity: 0.8,
            height_factor: 2.1,
            DISTANCE: 100
        },

        // 创建方向光，方向光可以增强画面的真实感
        createDirectionalLight: function () {
            /* 三个方向光的方向彼此成120°角，三个光源发射点构成了一个正三角形，它们的坐标分别是(0, a), (sqrt(3)/2*a, -1/2*a),
             * (-sqrt(3)/2*a, -1/2*a)。这个正三角形的几何中心是(0, 0)。
             */
            var parameters = this.directionalLightParameter;
            var a = parameters.DISTANCE;
            var i;
            var light = [];
            var lightTarget = new THREE.Object3D();
            var targetPos = new THREE.Vector3(0, 0, 0);
            var lightHeight = room.height * parameters.height_factor;
            lightTarget.position.copy(targetPos);
            for (i=0;i<3;i++) {
                var gray = parameters.gray;
                var hexColor = 256 * 256 * gray + 256 * gray + gray;
                // DirectionalLight( hex, intensity )
                light[i] = new THREE.DirectionalLight(hexColor, parameters.intensity);
                light[i].target = lightTarget;
                switch (i) {
                    case 0:
                        light[i].position.set(0, lightHeight, a);
                        break;
                    case 1:
                        light[i].position.set(Math.sqrt(3)/2*a, lightHeight, -1/2*a);
                        break;
                    case 2:
                        light[i].position.set(-Math.sqrt(3)/2*a, lightHeight, -1/2*a);
                        break;
                }
                scene.add(light[i]);
                directionalLightObject.push(light[i]);
            }
        },
        // 更新方向光
        updataDirectionalLight: function () {
            var parameters = this.directionalLightParameter;
            var a = parameters.DISTANCE;
            var i;
            var lightHeight = room.height * parameters.height_factor;
            var objects = directionalLightObject;
            for (i=0;i<objects.length;i++) {
                objects[i].color.setRGB(objects.gray/255, objects.gray/255, objects.gray/255);
                objects[i].intensity = objects.intensity;
                switch (i) {
                    case 0:
                        objects[i].position.set(0, lightHeight, a);
                        break;
                    case 1:
                        objects[i].position.set(Math.sqrt(3)/2*a, lightHeight, -1/2*a);
                        break;
                    case 2:
                        objects[i].position.set(-Math.sqrt(3)/2*a, lightHeight, -1/2*a);
                        break;
                }
            }
        },
        // 创建聚光灯
        createSpotLight: function (position, supportingFace, directionY) {
            if (!(position instanceof THREE.Vector3) || !(supportingFace instanceof THREE.Object3D)) {
                showmesg('参数错误！', true);
                return;
            }
            // 聚光灯的方向，默认是向下的
            var targetPosY = DEFAULT_SPOTLIGHT.targetPosY;
            switch (typeof directionY) {
                case 'number':
                    targetPosY = (directionY > 0) ? 1.01 : -1.01;
                    break;
                case 'boolean':
                    targetPosY = (directionY === true) ? 1.01 : -1.01;
                    break;
            }
            var spotLight = new THREE.SpotLight(0, DEFAULT_SPOTLIGHT.intensity, DEFAULT_SPOTLIGHT.distance, DEFAULT_SPOTLIGHT.angle);
            spotLight.castShadow = true;
            spotLight.color.setHex(256 * 256 * DEFAULT_SPOTLIGHT.red + 256 * DEFAULT_SPOTLIGHT.green + DEFAULT_SPOTLIGHT.blue);
            var lightTarget = new THREE.Object3D();
            var targetPos = new THREE.Vector3(DEFAULT_SPOTLIGHT.targetPosX, targetPosY, DEFAULT_SPOTLIGHT.targetPosZ);
            lightTarget.position.copy(targetPos);
            spotLight.target = lightTarget;
            spotLight.targetPosition = new THREE.Vector3();
            spotLight.targetPosition.copy(targetPos);
            // var spotLightHelper = new THREE.SpotLightHelper(spotLight);
            var spotLightHelper = null;
            var lightGroup = this.createLightGroup(spotLight, spotLightHelper, lightTarget, supportingFace);
            scene.add(lightGroup);
            // 移动光源组的位置
            var lightPos = new THREE.Vector3(position.x, position.y, position.z);
            this.moveLightGroup(lightGroup, lightPos);
        },
        // updateSpotLight()：更新聚光灯的相关设置
        updateSpotLight: function () {
            if (SELECTED_FOR_SETTING instanceof THREE.SpotLight && SELECTED_FOR_SETTING.parent instanceof THREE.Group) {
                SELECTED_FOR_SETTING.target.position.copy(SELECTED_FOR_SETTING.targetPosition);
            }
        },
        // createLightGroup()：创建光源组，包含光源本身、光源的辅助操作球、光源的辅助操作控件（如果有）、光照目标（如果有），附加参数是支撑平面
        createLightGroup: function (lightObject, lightObjectHelper, lightTarget, supportingFace) {
            if (lightObject === undefined) {
                showmesg('参数错误！', true);
                return;
            }
            var lightGroup = new THREE.Group();
            lightGroup.typename = hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP;
            lightGroup.helperVisible = false;
            lightGroup.supportingFace = supportingFace;
            // 添加光源本身
            // lightGroup.children[0] = lightObject;
            lightGroup.add(lightObject);
            // 添加用于辅助操作的光源球体
            var sphereGeo = new THREE.SphereGeometry(RADIUS_OF_LIGHT_SPHERE, WIDTHSEGMENTS_OF_LIGHT_SPHERE, HEIGHTSEGMENTS_OF_LIGHT_SPHERE);
            var sphereMat = new THREE.MeshStandardMaterial({color: COLOR_OF_LIGHT_SPHERE});
            var sphere = new THREE.Mesh(sphereGeo, sphereMat);
            // sphere.position.copy(lightObject.position);
            sphere.castShadow = false;
            sphere.receiveShadow = false;
            sphere.visible = true;
            sphere.typename = hDoObj.TYPE_FRIENDLY_NAME.LIGHT_SPHERE;
            sphere.supportingFace = supportingFace;
            // lightGroup.children[1] = sphere;
            lightGroup.add(sphere);
            // 添加光源辅助操作控件
            if (lightObjectHelper) {
                lightObjectHelper.typename = hDoObj.TYPE_FRIENDLY_NAME.LIGHT_HELPER;
            } else {
                lightObjectHelper = new THREE.Object3D();
            }
            // lightGroup.children[2] = lightObjectHelper;
            lightGroup.add(lightObjectHelper);
            // 添加光源目标
            if (lightTarget) {
                lightTarget.typename = hDoObj.TYPE_FRIENDLY_NAME.LIGHT_TARGET;
                // lightGroup.children[3] = lightTarget;
                lightGroup.add(lightTarget);
                lightGroup.children[0].target = lightGroup.children[3];
            } else {
                lightTarget = new THREE.Object3D();
                // lightGroup.children[3] = lightTarget;
                lightGroup.add(lightTarget);
            }
            return lightGroup;
        },
        // moveLightGroup()：移动光源组
        // newPosition - THREE的Vector3类型
        moveLightGroup: function(lightGroup, newPosition, newTargetPosition) {
            if (lightGroup === undefined || !(newPosition instanceof THREE.Vector3)) {
                showmesg('参数错误！', true);
                return;
            }
            lightGroup.position.copy(newPosition);
            if (newTargetPosition) {
                if (!(newTargetPosition instanceof THREE.Vector3)) {
                    showmesg('参数错误！', true);
                    return;
                }
                lightGroup.children[3].position.copy(newTargetPosition);
            }
            lightGroup.updateMatrixWorld();
        },
        // toggleLightHelper()：切换光源辅助控件的显示状态
        toggleLightHelper: function (lightGroup, setMode) {
            if (lightGroup.typename === hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP) {
                if (typeof setMode !== 'boolean') {
                    setMode = !lightGroup.helperVisible;
                }
                if (lightGroup.children[1] !== undefined) {
                    lightGroup.children[1].visible = setMode;
                }
                if (lightGroup.children[2] !== undefined) {
                    lightGroup.children[2].visible = setMode;
                }
            }
        },
        // 显示全部的光源辅助控件
        showAllLightHelper: function () {
            var i;
            for (i=0;i<scene.children.length;i++) {
                if (scene.children[i].typename === hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP) {
                    this.toggleLightHelper(scene.children[i], true);
                }
            }
        },

        // 隐藏全部的光源辅助控件
        hideAllLightHelper:function () {
            var i;
            for (i=0;i<scene.children.length;i++) {
                if (scene.children[i].typename === hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP) {
                    this.toggleLightHelper(scene.children[i], false);
                }
            }
        }
    };

    return publicSet;
}();

// 存储户型的墙体数据
var apartmentWall = [];
// 户型文件的数据apartmentData
var apartmentData;

function convertDrawWallCoordToWebGLCoord(x) {
    "use strict";
    return ( x / 350);
}

// 加载户型文件，通过使用HTML5原生支持的本地存储（localStorage）或会话存储（sessionStrorage）
function loadApartment() {
    "use strict";
    var i;
    // 从户型的数据文件中解析数据，并绘制
    apartmentData = JSON.parse(sessionStorage.walldesign);

    var p1 = [0, 0];
    var p2 = [0, 0];
    var v1 = new THREE.Vector2();
    var v2 = new THREE.Vector2();
    // 绘制墙壁
    for (i=0;i<apartmentData.data.length;i+=2) {
        p1 = apartmentData.data[i];
        p1.x = convertDrawWallCoordToWebGLCoord(parseFloat(p1.x));
        p1.y = convertDrawWallCoordToWebGLCoord(parseFloat(p1.y));
        apartmentWall[i] = new THREE.Vector2();
        apartmentWall[i].x = p1[0];
        apartmentWall[i].y = p1[1];
        p2 = apartmentData.data[i+1];
        p2.x = convertDrawWallCoordToWebGLCoord(parseFloat(p2.x));
        p2.y = convertDrawWallCoordToWebGLCoord(parseFloat(p2.y));
        apartmentWall[i+1] = new THREE.Vector2();
        apartmentWall[i+1].x = p2[0];
        apartmentWall[i+1].y = p2[1];
        drawSingleWall(p1, p2);
    }
    var middle = new THREE.Vector2();
    var temp = new THREE.Vector2();
    var centerPos = new THREE.Vector3();
    var index = 0;
    var doorLength = 0;
    // 绘制门
    for (i=0;i<apartmentData.door.length;i+=2) {
        p1 = apartmentData.door[i];
        p1.x = convertDrawWallCoordToWebGLCoord(parseFloat(p1.x));
        p1.y = convertDrawWallCoordToWebGLCoord(parseFloat(p1.y));
        v1.x = p1[0];
        v1.y = p1[1];
        p2 = apartmentData.door[i+1];
        p2.x = convertDrawWallCoordToWebGLCoord(parseFloat(p2.x));
        p2.y = convertDrawWallCoordToWebGLCoord(parseFloat(p2.y));
        v2.x = p2[0];
        v2.y = p2[1];
        middle.copy(v1).add(v2).multiplyScalar(0.5);
        index = findWall(middle);
        if (index === -1) {
            continue;
        }
        temp.copy(v2).sub(v1);
        doorLength = temp.length();
        centerPos.x = middle.x;
        centerPos.y = room.doorTop / 2;
        centerPos.z = middle.y;
        createSurfacePlane(scene.children[index], centerPos, true, doorLength, room.doorTop, hDoObj.TYPE_FRIENDLY_NAME.DOOR,'null',v1,v2);
    }
    var windowLength = 0;
    // 绘制窗户
    for (i=0;i<apartmentData.wind.length;i+=2) {
        p1 = apartmentData.wind[i];
        p1.x = convertDrawWallCoordToWebGLCoord(parseFloat(p1.x));
        p1.y = convertDrawWallCoordToWebGLCoord(parseFloat(p1.y));
        v1.x = p1[0];
        v1.y = p1[1];
        p2 = apartmentData.wind[i+1];
        p2.x = convertDrawWallCoordToWebGLCoord(parseFloat(p2.x));
        p2.y = convertDrawWallCoordToWebGLCoord(parseFloat(p2.y));
        v2.x = p2[0];
        v2.y = p2[1];
        middle.copy(v1).add(v2).multiplyScalar(0.5);
        index = findWall(middle);
        if (index === -1) {
            continue;
        }
        temp.copy(v2).sub(v1);
        windowLength = temp.length();
        centerPos.x = middle.x;
        centerPos.y = (room.windowBottom + room.windowTop) / 2;
        centerPos.z = middle.y;
        createSurfacePlane(scene.children[index], centerPos, true, windowLength, (room.windowTop - room.windowBottom),
            hDoObj.TYPE_FRIENDLY_NAME.WINDOW,'null',v1,v2);
    }
    var initPos = new THREE.Vector2();
    // 设置相机的初始位置
    for (i=0;i<apartmentWall.length;i++) {
        initPos.add(apartmentWall[i]);
    }
    initPos.multiplyScalar(1/apartmentWall.length);
    hCamera.setPosition(initPos.x, 0, initPos.y);
}
// 点和墙壁距离的最大容忍数值
var MAX_TOLERANT_DISTANCE= 0.1;
// 通过一个点来寻找这个点所在的墙壁
// 返回值：墙壁在scene.children中的索引位置，如果没有找到就返回-1。
function findWall(point) {
    "use strict";
    var i;
    if (!(point instanceof THREE.Vector2)) {
        showmesg('参数错误！', true);
        return ;
    }
    for (i=0;i<scene.children.length;i++) {
        if (scene.children[i].typename === hDoObj.TYPE_FRIENDLY_NAME.WALL) {
            var left = scene.children[i].leftPoint;
            var right = scene.children[i].rightPoint;
            if (left.x === right.x) {
                if (Math.abs(point.x - left.x)<MAX_TOLERANT_DISTANCE) {
                    // 点到墙壁的距离足够近，可以认定这个点属于这一面墙壁
                    return i;
                }
            }
            if (left.y === right.y) {
                if (Math.abs(point.y - left.y)<MAX_TOLERANT_DISTANCE) {
                    // 点到墙壁的距离足够近，可以认定这个点属于这一面墙壁
                    return i;
                }
            }
            // left.x !== right.x 且 left.y !== right.y
            var k = (right.y - left.y) / (right.x - left.x);
            var b = left.y - k * left.x;
            var dist = Math.abs(k * point.x + b - point.y) / Math.sqrt(k * k + 1); // 点到直线的距离
            if (dist < MAX_TOLERANT_DISTANCE) {
                return i;
            }
        }
    }
    // 如果遍历完成，则说明没有找到合适的点
    return -1;
}

// 地板和天花板的边界顶点组
var FLOOR_VERTICES = [
    [-500, 800],
    [800, 800],
    [800, -500],
    [-500, -500]
];

// -----------------
//  模块:相机部分
// -----------------
// 创建three.js中的场景（相机和渲染器分别在之后的两个h.模块里定义）
var scene = new THREE.Scene();

var camera;
var hCamera = function () { // open IIFE
    "use strict";

    // private attributes and methods
    // 当前的相机类型
    var curType = null;
    // 相机的位置
    var position = null;
    // 所有相机引用
    var objRef = [null, null, null];
    // TODO: 增加自旋转视角
    // 相机的类型
    var TYPE = {
        SPINNING: 0,        // 固定旋转视角
        TOURIST: 1,         // 游览视角
        length: 2           // 表示总的类型个数，用于循环切换
    };
    // 默认的相机类型
    var DEFAULT_TYPE = 0;
    // 对用户友好的名称
    var NAME = {
        0: '固定旋转视角',
        1: '游览视角'
    };

    // public attributes and methods
    // 下面的参数列表中，1是一个缺省值，没有实际意义，仅仅为了传参方便。
    var publicSet = {
        //  向前移动的步长
        step: 1,
        // 三种相机模式的参数
        spinning: {
            x: 1,               // 转轴的x位置
            z: 1,               // 转轴的z位置
            radius: 40,         // 旋转半径
            rho: 0,             // 旋转经过的角度数（角度偏移量），不应该修改它
            height: 40,         // 高度
            speed: 0.01,      // 相机旋转的速度
            lookAtHeight: 10,   // 画面中心点高度
            DEFAULT_ROTATING_SPEED: 0.005,
            MOVING_STEP: 0.1,
            fov:100
        },
        tourist: {
            positionX: 1,       // 观察者在X轴的位置，不应该修改它
            positionZ: 1,       // 观察者在Z轴的位置，不应该修改它
            rho: 0,             // 观察者在平行于地面的水平面中朝向的角度数（角度偏移量），不应该修改它
            // 重要提醒：如果观察者视线的高度太低，在游览视图中，点选地面上的物体将不能进行拖动。
            height: 20,         // 观察者视线的高度
            step: 1,          // 观察者前进的步长
            rotationStep: hTools.ONE_DEGREE_IN_RADIANS * 2,         // 观察者旋转的步长
            ROTATING_STEP: 0.01,
            MOVING_STEP: 0.5
        },
        // 当前的相机引用
        obj: null,
        // 初始化函数
        initialize: function () {
            objRef[TYPE.SPINNING] = new THREE.PerspectiveCamera(this.spinning.fov, 1.8, 0.1, 10000);
            objRef[TYPE.TOURIST] = new THREE.PerspectiveCamera(75, 6.5, 0.1, 10000);
            curType = DEFAULT_TYPE;
            this.obj = objRef[DEFAULT_TYPE];
            position = new THREE.Vector3(0, 0, 0);
            // this.update();
        },
        // setPosition()：设置相机的位置
        setPosition: function(x, y, z) {
            position.set(x, y, z);
        },
        // getTypeName()：获取当前相机类型的名称
        getTypeName: function () {
            return NAME[curType];
        },
        // KeyEventsHandler()：键盘事件处理，目前处理方向键
        KeyEventsHandler: function (keyCode) {
            switch (curType) {
                // TODO: 在游览模式下按方向键，效果是改变视角的位置
                case TYPE.SPINNING:
                    // 如果处在旋转模式的不显示动画的状态下，可以移动相机
                    if (!hRender.playAnimation) {
                        switch (keyCode) {
                            case 38:
                                position.x -= this.step * Math.cos(this.spinning.rho);
                                position.z -= this.step * Math.sin(this.spinning.rho);
                                break;
                            case 40:
                                position.x += this.step * Math.cos(this.spinning.rho);
                                position.z += this.step * Math.sin(this.spinning.rho);
                                break;
                        }
                    }
                    break;
                case TYPE.TOURIST:
                    // Key Code: 37 - Left, 38 - Up, 39 - Right, 40 - Down
                    switch (keyCode) {
                        case 37:
                            this.tourist.rho -= this.tourist.rotationStep;
                            break;
                        case 38:
                            position.x += this.step * Math.cos(this.tourist.rho);
                            position.z += this.step * Math.sin(this.tourist.rho);
                            break;
                        case 39:
                            this.tourist.rho += this.tourist.rotationStep;
                            break;
                        case 40:
                            position.x -= this.step * Math.cos(this.tourist.rho);
                            position.z -= this.step * Math.sin(this.tourist.rho);
                            break;
                    }
                    break;
            }
        },
        // update(): 每次更新相机的时候被调用，典型例子是动画循环。
        update: function () {
            var curCamera;
            switch (curType) {
                case TYPE.SPINNING:
                    // 绕轴旋转的相机：使用透视相机
                    // PerspectiveCamera( fov, aspect, near, far )
                    curCamera = objRef[TYPE.SPINNING];
                    curCamera.position.set(position.x + this.spinning.radius * Math.cos(this.spinning.rho), this.spinning.height,
                        position.z + this.spinning.radius * Math.sin(this.spinning.rho));
                    // 根据是否播放动画来决定是否旋转相机
                    if (hRender.playAnimation) {
                        this.spinning.rho += this.spinning.speed;
                    }
                    curCamera.lookAt(new THREE.Vector3(position.x, this.spinning.lookAtHeight, position.z));
                    break;
                case TYPE.TOURIST:
                    // 游览视角的相机：使用透视相机
                    curCamera = objRef[TYPE.TOURIST];
                    position.y = this.tourist.height;
                    curCamera.position.copy(position);
                    curCamera.lookAt(new THREE.Vector3(position.x + Math.cos(this.tourist.rho),
                        this.tourist.height, position.z + Math.sin(this.tourist.rho)));
                    break;
            }
            // 设置宽高比
            curCamera.aspect = canvaswidth/ canvasheight;
            // 更新相关的矩阵
            curCamera.updateMatrixWorld();
            // 输出
            this.obj = curCamera;
            camera = curCamera;
        },
        // nextType()：切换到下一个类型的相机
        nextType: function () {
            var i;
            // 设置状态量
            curType = (curType + 1) % TYPE.length;
            popup.showPopup('当前是' + this.getTypeName());


            // 控制俯视图的情况下不显示天花板，更好的实现方式可能是使用遍历函数traverse()对scene的所有孩子进行遍历
                for (i = 0; i < scene.children.length; i++) {
                    if (scene.children[i].typename === hDoObj.TYPE_FRIENDLY_NAME.CEILING) {
                        scene.children[i].visible = true;
                    }
                }


            // 显示菜单
            //menuON();
        }
    };

    return publicSet;
}();    // close IIFE
hCamera.initialize();


// -------------------
//  模块：WebGL渲染器
// ------------------

var hRender = function(){    // open IIFE
    "use strict";

    var requestId = null;
    var renderer = null;
    var DEFAULT_BACKGROUND_COLOR = 0x222222;

    // public attributes and methods
    var publicSet = {
        // 指定是否播放动画，默认播放
        playAnimation: false,
        // Redraw(): It will redraw the whole canvas, so that we should call it as less as possible.
        redraw: function () {
            var i;

            // 设置覆盖层
            // toggleOverlayLayer('drawwall');;
            // toggleOverlayLayer(true);

            // 删除场景中任何已有元素
            if (scene !== undefined) {
                var listLength = scene.children.length;
                for (i=0;i<listLength;i++) {
                    scene.remove(scene.children[0]);
                }
            }

            // 为避免多个requestAnimationFrame()循环同时绘制图像，造成帧速率太高（远高于60FPS），停止已有的绘制刷新循环
            if (requestId) {
                window.cancelAnimationFrame(requestId);
                requestId = undefined;
            }


            // -------------------------------------------------------------
            // 初始化新的图形绘制，绘制整个场景
            // -------------------------------------------------------------
            // Three basic elements in Three.js are: Scene, camera, renderer.
            // 初始化渲染器为使用WebGL的绑定到ID为“canvas”的元素，参数使用JSON表示。
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                canvas: hTools.DOM_Handle.CANVAS
            });

            // 重设渲染器的大小为窗口大小；否则，默认的渲染大小很小，在屏幕上显示出大的块状。
            // setSize()同时会改变画布大小
            renderer.setSize(canvaswidth, canvasheight);

            renderer.setClearColor(DEFAULT_BACKGROUND_COLOR);
            if (window.devicePixelRatio) {
                renderer.setPixelRatio(window.devicePixelRatio);
            }
            renderer.sortObjects = false;

            // Cause lights will determine how the shader do rendering, we should deal with the lights before the objects.
            // Lights.initialize();
            // Lights.update();

            // 创建方向光和环境光
            hLight.createDirectionalLight();
            hLight.createAmbientLight();
            // 不显示所有的灯光助手
            hLight.hideAllLightHelper();

            // 绘制很大的天花板和地板
            loadFloorAndCeiling([0, 0], FLOOR_VERTICES, {floorFill: 'images/materials/white.jpg'});

            // 加载户型数据，并进行解析和绘制
            if (!USING_DEBUGGING_SCENE){
                loadApartment();
            }

            // 添加星空背景
            starsBackground();

            if (USING_DEBUGGING_SCENE) {
                // 绘制一系列用于参考的图形
                this.loadBasicShape();

                // 显示一个坐标轴，红色X，绿色Y，蓝色Z
                var axisHelper = new THREE.AxisHelper(1000);
                scene.add(axisHelper);

                // 显示参考网格
                var gridHelper = new THREE.GridHelper(10, 20);
                var gridHelper2 = new THREE.GridHelper(10, 20);
                gridHelper2.position.y = room.height;
                scene.add(gridHelper);
                scene.add(gridHelper2);
                var gridHelper3 = new THREE.GridHelper(10, 20);
                gridHelper3.rotateX(Math.PI / 2);
                gridHelper3.position.z = 8;
                scene.add(gridHelper3);
                var gridHelper4 = new THREE.GridHelper(10, 20);
                gridHelper4.rotateX(Math.PI / 2);
                gridHelper4.position.z = -8;
                scene.add(gridHelper4);
                var gridHelper5 = new THREE.GridHelper(10, 20);
                gridHelper5.rotateZ(Math.PI / 2);
                gridHelper5.position.x = 8;
                scene.add(gridHelper5);
                var gridHelper6 = new THREE.GridHelper(10, 20);
                gridHelper6.rotateZ(Math.PI / 2);
                gridHelper6.position.x = -8;
                scene.add(gridHelper6);
            }

            // 射线，用于拾取(pick)对象
            rayCaster = new THREE.Raycaster();

            // 启用帧速率显示
            // hTools.FPS();

            // 渲染循环
            this.renderLoop();
        },
        renderLoop: function() {
            requestId = requestAnimationFrame(hRender.renderLoop);
            hCamera.update();
            // 用于统计帧速率
            hTools.countFrame();
            hRayCasting.pickObject();
            renderer.render(scene, hCamera.obj);
        },
        animate: function() {
            // cameraEllipseAnimate.animate(Camera.camera);
        }
    };

    return publicSet;
}();




// -------------------------------------------------------
//   模块:光线投射部分（The Ray Casting Part）
// -------------------------------------------------------

// INTERSECTED鼠标发出射线与3D界面内第一个相交的物体（鼠标指向的位于最前端的物体），通过pickObject赋值
var INTERSECTED;

var hRayCasting = function() {  // open IIFE
    "use strict";

    // private attributes and methods
    // 用于物体的拖动，这些变量必须初始化为相应的类型，不然赋值的过程中会出错。
    var plane = new THREE.Plane();
    // INTERSECTED_COLOR表示INTERSECTED对象的自发光颜色。
    var INTERSECTED_COLOR = 0x696969;   // 偏灰白色

    var selectByMouse = true;

    // public attributes and methods
    var publicSet = {
        // 表示当前鼠标拖动选定的对象。不应该初始化这个变量。
        SELECTED: null,
        // 用于物体的拖动，这些变量必须初始化为相应的类型，不然赋值的过程中会出错。
        intersection: new THREE.Vector3(),
        offset: new THREE.Vector3(),
        // 删除选定
        deleteSelecting: function () {
            if (INTERSECTED) {
                // 用于选定导入的OBJ模型对象的整体
                if (INTERSECTED instanceof THREE.Group) {
                    // 由于THREE.Group类型没有定义emissive，所以必须对它的所有孩子设置emissive
                    for (var i2 = 0; i2 < INTERSECTED.children.length; i2++) {
                        var child = INTERSECTED.children[i2];
                        if (child.material.emissive) {
                            child.material.emissive.setHex(INTERSECTED.currentHex);
                            child.currentHex = undefined;
                        }
                    }
                } else {
                    INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
                    INTERSECTED.currentHex = undefined;
                }
            }
            INTERSECTED = null;
        },

        // 用于拾取(pick)对象，并将结果存放到INTERSECTED。
        pickObject: function () {
            // 用于拾取(pick)对象，拾取对象之后，给对象加一个浅白色的表面遮罩
            /*
             * MeshBasicMaterial为材质的对象,material中没有emissive属性，会出现异常。故设置对象时应避免使用MeshBasicMaterial
             */
            var i;
            var child;
            // 如果选定功能已经被toggleSelectByMouse()禁用，或者鼠标不位于左侧面板
            if (selectByMouse === false || hEvent.isMouseOnRightPanel()) {
                return;
            }
            // 从光标坐标出发，从相机视角（图像渲染的最后阶段）建立一条射线。
            rayCaster.setFromCamera(hEvent.mousePosition, camera);
            // 用于移动物体
            // 如果已经处于拖动物件的状态，只需改变物体的位置position
            if (hRayCasting.SELECTED) {
                // 找出射线与平面的相交位置，这里的平面是所选对象的支撑面
                // 初始化supportingPlane，赋值为new THREE.Plane()是必须的
                var supportingPlane = new THREE.Plane();
                if (isSupportingFace(hRayCasting.SELECTED)) {
                    // 企图移动支撑面
                    showmesg('企图移动支撑面', true);
                    return;
                    // generateMathPlane(hRayCasting.SELECTED, supportingPlane);
                } else {
                    // 企图移动对象，因此根据对象的支撑面去找到这个数学意义上的平面
                    generateMathPlane(hRayCasting.SELECTED.supportingFace, supportingPlane);
                }
                // 已经得到了一个数学意义上的支撑平面supportingPlane，求交点intersection
                var intersection = this.intersection;
                var offset = this.offset;
                if (rayCaster.ray.intersectPlane(supportingPlane, intersection)) {
                    // showmesg('交点y=' + intersection.y);
                    // 判断移动的物体是不是光源的辅助操作球
                    if (hRayCasting.SELECTED.typename === hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP) {
                        showmesg('尝试移动操作');
                        hLight.moveLightGroup(hRayCasting.SELECTED, intersection.sub(offset));
                    } else {
                        hRayCasting.SELECTED.position.copy(intersection.sub(offset));
                    }
                }
                return;
            }
            // 从场景中选择相交的对象，中间省略了很多步骤，Three.js为我们做了封装。
            /* 导入的模型不能直接拾取的原因是，模型导入之后，在THREE.Mesh的外面加了一层壳THREE.Group，这在浏览器的调试窗口中下断点
             * 可以看到。如果此处使用intersectObjects(scene.children)，则不能处理这种壳。但是使用
             * intersectObjects(scene.children, true)就可以解决这个问题。其中的true是布尔变量，表示是否对scene（本质上是一个
             * THREE.Object3D类型的变量）进行深度优先遍历。
             * 普通模型直接add到scene：    scene -> Three.Mesh
             * 导入obj模型，再add到scene： scene -> Three.Group -> Three.Mesh
             * 注意，Three.Scene，Three.Group和Three.Mesh都继承自Three.Object3D。
             */
            // http://stackoverflow.com/questions/25667394/three-js-mouse-picking-object
            var intersects = rayCaster.intersectObjects(scene.children, true);
            // 如果选取到的相交对象的数组不空，用firstPickedObject存放实际选取到的
            var firstPickedObject;
            if (intersects.length > 0) {
                // 如果有GridHelper等我们不需要的对象挡在前面，相当于没有这些对象，应该略过
                for (i = 0; i < intersects.length; i++) {
                    /* 排除的对象的种类：
                     *  (1) 坐标类：网格助手、坐标助手
                     *  (2) 灯光类：灯光、灯光范围助手
                     */
                    if (intersects[i].object instanceof THREE.GridHelper) {
                        continue;
                    } else if (intersects[i].object instanceof THREE.AxisHelper) {
                        continue;
                    } else if (intersects[i].object instanceof THREE.DirectionalLightHelper) {
                        continue;
                    } else if (intersects[i].object instanceof THREE.HemisphereLightHelper) {
                        continue;
                    } else if (intersects[i].object instanceof THREE.PointLightHelper) {
                        continue;
                    } else if (intersects[i].object instanceof THREE.SpotLightHelper) {
                        continue;
                    } else if (intersects[i].object instanceof THREE.SpotLight) {
                        continue;
                    } else if (intersects[i].object instanceof THREE.LineSegments) {
                        continue;
                    } else if (intersects[i].object.typename === hDoObj.TYPE_FRIENDLY_NAME.BACKGROUND){
                        continue;
                    } else {
                        firstPickedObject = intersects[i].object;
                        break;
                    }
                }
                // if (firstPickedObject === undefined) {
                //     showmesg('firstPickedObject未定义');
                // }
                if (firstPickedObject) {
                    /* 用INTERSECTED存储了绘制上一帧时，最靠近相机的鼠标可选择的对象。如果旧的可选择的对象和这个对象相同（鼠标的移动很
                     * 微小），那么不用做任何改变；否则，要更新已经选择的对象，让它发出纯蓝色的光，并将以前已经选择的对象和新的已经选择
                     * 的对象更新。
                     */
                    if (INTERSECTED !== firstPickedObject || INTERSECTED !== firstPickedObject.parent) {
                        // 如果有已经更换外表发光颜色的对象，即INTERSECTED已经不是空的，需要恢复这个对象的外表发光状态
                        // 用于选定导入的OBJ模型对象或者光源对象的整体
                        if (INTERSECTED instanceof THREE.Group) {
                            // 使用THREE.Group的情况目前有两种：要么是导入的OBJ模型，要么是光源
                            if (INTERSECTED.typename === hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP) {
                                child = INTERSECTED.children[1];
                                if (child.material.emissive) {
                                    child.material.emissive.setHex(INTERSECTED.currentHex);
                                    child.currentHex = undefined;
                                }
                            } else {
                                // 由于THREE.Group类型没有定义emissive，所以必须对它的所有孩子设置emissive
                                for (i = 0; i < INTERSECTED.children.length; i++) {
                                    child = INTERSECTED.children[i];
                                    if (child.material.emissive) {
                                        child.material.emissive.setHex(INTERSECTED.currentHex);
                                        child.currentHex = undefined;
                                    }
                                }
                            }
                        } else if (INTERSECTED) {
                            INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
                            INTERSECTED.currentHex = undefined;
                        }
                        INTERSECTED = firstPickedObject;
                        // 对于新的需要发光外表的对象，设置它的外表发光
                        // 用于选定导入的OBJ模型对象的整体或者光源对象的整体
                        if (INTERSECTED.parent instanceof THREE.Group) {
                            INTERSECTED = INTERSECTED.parent;
                            // 使用THREE.Group的情况目前有两种：要么是导入的OBJ模型，要么是光源
                            if (INTERSECTED.typename === hDoObj.TYPE_FRIENDLY_NAME.LIGHT_GROUP) {
                                child = INTERSECTED.children[1];
                                if (child.material.emissive) {
                                    child.currentHex = child.material.emissive.getHex();
                                    child.material.emissive.setHex(INTERSECTED_COLOR);
                                }
                            } else {
                                // 由于THREE.Group类型没有定义emissive，所以必须对它的所有孩子设置emissive
                                for (i = 0; i < INTERSECTED.children.length; i++) {
                                    child = INTERSECTED.children[i];
                                    if (child.material.emissive) {
                                        child.currentHex = child.material.emissive.getHex();
                                        child.material.emissive.setHex(INTERSECTED_COLOR);
                                    }
                                }
                            }
                        } else {
                            INTERSECTED.currentHex = INTERSECTED.material.emissive.getHex();
                            INTERSECTED.material.emissive.setHex(INTERSECTED_COLOR);
                        }
                        // if (INTERSECTED.typename) {
                        //     showmesg('可选择的对象名字是' + INTERSECTED.typename);
                        //     showmesg(INTERSECTED.uuid);
                        // }
                        /* plane的赋值和初始化。该平面以相机的
                         * camera方法：
                         * getWorldDirection(vector)        （参数vector可选）
                         * It returns a vector representing the direction in which the camera is looking, in world space.
                         * plane方法：
                         * setFromNormalAndCoplanarPoint(normal, point)
                         * 设置平面。该平面的方向向量为normal，经过点point。
                         */
                        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(plane.normal), INTERSECTED.position);
                    }
                    hTools.DOM_Handle.CANVAS.style.cursor = 'pointer';
                }
            }
            if (!firstPickedObject) {
                /* 不然，选取的对象数组是空的。在这一帧内，应该没有元素处于被选中的状态。那么，之前有选中的元素，应该恢复它原来的发光色
                 * 。最后，对于下一帧来说，没有被选中的元素。
                 */
                this.deleteSelecting();
                hTools.DOM_Handle.CANVAS.style.cursor = 'auto';
            }
        },
        // 从场景中删除对象
        deleteObjectFromScene: function() {
            if (INTERSECTED && hDoObj.canDelete(INTERSECTED)) {
                if (INTERSECTED.typename === hDoObj.TYPE_FRIENDLY_NAME.LIGHT_SPHERE) {
                    INTERSECTED = INTERSECTED.parent;
                }
                scene.remove(INTERSECTED);
            }
        }
    };

    return publicSet;
}();    // close IIFE

















// 加载JSON文件，这个函数不应该被调用，仅作参考
var jsondata;

function loadJSON(location) {
    "use strict";
    // 重要提醒：千万不要在JSON中使用双斜线添加注释，会导致jQuery无法加载对象，并且不调用回调函数的错误！！！
    $.get(location, function (data, status) {
        if (status === 'success') {
            // popup.showPopup('成功获取JSON文件：' + location);
        } else {
            showmesg('获取JSON文件(' + location + ')失败', true);
        }
        jsondata = data;
    });
}

// 菜单列表
var menulist = [
    {
        id: 'addobj',
        chsname: '添加家具',
        url: ['json/pagedata/obj-add.json']
    },
    {
        id: 'addelec',
        chsname: '添加电器',
        url: [
            'json/pagedata/elec-add.json'
        ]
    },
    {
        id: 'lamp',
        chsname: '添加灯具',
        url: [
            'json/pagedata/lamp-add.json'
        ]
    },
    {
        id: 'addsp',
        chsname: '添加挂饰',
        url: [
            'json/pagedata/surfaceplane-add.json'
        ]
    }
];
// 初始化侧边面板
function initSidePanel() {
    "use strict";
    document.getElementById('obj').onclick=function () {loadSidePanel(menulist[0].url[0],'left');}
    document.getElementById('elec').onclick=function () {loadSidePanel(menulist[1].url[0],'left');}
    document.getElementById('lamp').onclick=function () {loadSidePanel(menulist[2].url[0],'left');}
    document.getElementById('sp').onclick=function () {loadSidePanel(menulist[3].url[0],'left');}

    loadSidePanel(menulist[0].url[0],'left');
}

// 当前加载的侧边面板的数据文件
var curSidePanelURL;
// 生成侧边面板
function loadSidePanel(location,whichpanel) {
    "use strict";
    // 如果当前选择的侧边面板数据已经加载了，直接退出以提升效率
    if (location === curSidePanelURL) {
        return;
    } else {
        curSidePanelURL = location;
    }
    // 重要提醒：千万不要在JSON中使用双斜线添加注释，会导致jQuery无法加载对象，并且不调用回调函数的错误！！！
    $.get(location, function (data, status) {
        if (status === 'success') {
            popup.showPopup('成功获取JSON文件：' + location);
        } else {
            showmesg('获取JSON文件(' + location + ')失败', true);
        }
        parseSidePanelPageData(data,whichpanel);
    });
}


// TODO: 按照角度制旋转OBJ对象
// 在菜单栏中选定的，要导入的对象
var SELECT_IN_MENU;
// 解析描述侧边面板的JSON结构数据
// 解析描述侧边面板的JSON结构数据
function parseSidePanelPageData(pagedata,whichpanel) {
    "use strict";
    var i;
    if ((typeof (pagedata)) !== 'object') {
        showmesg('json数据错误', true);
        return;
    }
    if (pagedata.filetype !== 'pagedata' || pagedata.content === undefined) {
        showmesg('json类型定义错误', true);
        return;
    }
    var cinst;
    var clist;
    if(whichpanel=='left'){
        $('#leftctitle').text(pagedata.content.title);
        cinst = $('#leftcinst');
        clist = document.getElementById('leftclist');
    }else if(whichpanel=='right'){
        $('#rightctitle').text(pagedata.content.title);
        cinst = $('#rightcinst');
        clist = document.getElementById('rightclist');
    }
    // 检查instruction字段是否有定义
    var inst = pagedata.content.instruction;
    if (inst !== undefined && inst !== '') {
        cinst.text(inst);
        cinst.css('display', 'block');
    } else {
        cinst.css('display', 'none');
    }
    // 有可能在list中存在已有的数据，需要先赋值空字符串以清空列表。
    clist.innerHTML = '';
    // 构建侧边面板的清单
    var p;
    var img;
    for (i = 0; i < pagedata.content.items.length; i++) {
        var li = document.createElement('li');
        var item = pagedata.content.items[i];
        switch (item.typename) {
            case 'configuration':
                p = document.createElement('p');
                p.innerHTML = item.chsname;
                li.appendChild(p);
                if (typeof item.varible !== 'string') {
                    showmesg('没有指定变量名！！', true);
                    break;
                }
                var min = item.min ? item.min : 0;
                var max = item.max ? item.max : 100;
                var step = item.step ? item.step : 1;
                var precision = item.precision ? item.precision : 0;
                var numctrl;
                if (typeof item.callback === 'string') {
                    numctrl = new NumberBind(item.varible, min, max, step, precision, item.callback);
                } else {
                    numctrl = new NumberBind(item.varible, min, max, step, precision);
                }
                li.appendChild(numctrl.domElement);
                break;
            case 'button':
                p = document.createElement('p');
                p.innerHTML = item.chsname;
                p.setAttribute('onclick', item.callback);
                li.appendChild(p);
                break;
            case 'texture':
                p = document.createElement('p');
                p.innerHTML = item.chsname;
                img = document.createElement('img');
                // 给li设置的各个属性，在后面click中可以用“this.”访问到
                li.imageURL = pagedata.content.directory + item.filename;
                img.setAttribute('src', li.imageURL);
                li.appendChild(img);
                li.appendChild(p);
                break;
            default:
                p = document.createElement('p');
                p.innerHTML = item.chsname;
                img = document.createElement('img');
                // 给li设置的各个属性，在后面click中可以用“this.”访问到
                switch (pagedata.operation) {
                    case 'obj-add':
                        li.imageURL = pagedata.content.imgdir + item.filename + '.png';
                        break;
                    case 'surfaceplane-add':
                        li.imageURL = item.path + item.filename;
                        break;
                    default:
                        break;
                }
                img.setAttribute('src', li.imageURL);
                li.appendChild(img);
                li.appendChild(p);
                li.uuid = THREE.Math.generateUUID();
                li.typename = item.typename;
                li.path = item.path;
                li.filename = item.filename;
                if (item.supportingface) {
                    li.supportingface = item.supportingface;
                }
                break;
        }
        clist.appendChild(li);
    }
    if(whichpanel=='left'){
    switch (pagedata.operation) {
        case 'obj-add':
            // 对于清单中的每一项，触发点击事件click
            $('#leftclist').children().click(function () {
                window.console.log(this.path);
                showmesg(this.uuid);
                showmesg(this.path + ' ' + this.filename + ' ' + this.typename);
                // 首先清除SELECT_IN_MENU的已有对象
                SELECT_IN_MENU = {};
                // 向SELECT_IN_MENU中写入新的对象信息
                SELECT_IN_MENU.uuid = this.uuid;
                SELECT_IN_MENU.typename = this.typename;
                SELECT_IN_MENU.path = this.path;
                SELECT_IN_MENU.filename = this.filename;
                console.log('objadd测试！！！！！！');
                console.log(SELECT_IN_MENU.typename);
                console.log(SELECT_IN_MENU);


                if (this.supportingface) {
                    SELECT_IN_MENU.supportingface = this.supportingface;
                }
                // 此时，等待用户点选下一个位置，如果点选的下一个位置是支撑面的位置，则放置家具。
            });
            break;
        case 'surfaceplane-add':
            // 对于清单中的每一项，触发点击事件click
            $('#leftclist').children().click(function () {
                showmesg(this.uuid);
                showmesg(this.path + ' ' + this.filename + ' ' + this.typename);
                // 首先清除SELECT_IN_MENU的已有对象
                SELECT_IN_MENU = {};
                // 向SELECT_IN_MENU中写入新的对象信息
                SELECT_IN_MENU.imageURL = this.imageURL;
                SELECT_IN_MENU.typename = this.typename;
                if (this.supportingface) {
                    SELECT_IN_MENU.supportingface = this.supportingface;
                }
                // 此时，等待用户点选下一个位置，如果点选的下一个位置是支撑面的位置，则放置家具。
                console.log('左边调试壁画！！！！！');
                console.log(SELECT_IN_MENU);


            });
            break;
        case 'light-add':
            // 对于清单中的每一项，触发点击事件click
            $('#leftclist').children().click(function () {
                // 首先清除SELECT_IN_MENU的已有对象
                SELECT_IN_MENU = {};
                // 向SELECT_IN_MENU中写入新的对象信息
                SELECT_IN_MENU.uuid = this.uuid;
                SELECT_IN_MENU.typename = this.typename;
                SELECT_IN_MENU.supportingface = this.supportingface;
                // 此时，等待用户点选下一个位置，如果点选的下一个位置是支撑面的位置，则放置家具。
            });
            break;
        case 'window-texture':
        case 'door-texture':
            $('#leftclist').children().click(function () {
                SELECTED_FOR_SETTING.imageURL = this.imageURL;
                console.log('door-texture左边测试！！！！！！！');
                console.log('材质是'+SELECTED_FOR_SETTING.imageURL);
                console.log('门窗'+SELECTED_FOR_SETTING.name+' 的位置是 '+SELECTED_FOR_SETTING.position.x+" "+SELECTED_FOR_SETTING.position.z);//TODO:与VR界面相对应
                console.log(SELECTED_FOR_SETTING);


                showmesg(SELECTED_FOR_SETTING.imageURL);
                updateSurfacePlaneByTexture();
            });
            break;
        case 'floor-texture':
        case 'wall-texture':
            $('#leftclist').children().click(function () {
                SELECTED_FOR_SETTING.imageURL = this.imageURL;
                console.log('floor&wall-texture左边测试！！！！！！！！');
                console.log('地板和墙'+SELECTED_FOR_SETTING.name+' 的位置是 '+SELECTED_FOR_SETTING.position.x+" "+SELECTED_FOR_SETTING.position.z);
                console.log(SELECTED_FOR_SETTING.imageURL);
                console.log(SELECTED_FOR_SETTING);


                showmesg(SELECTED_FOR_SETTING.imageURL);
                updatePlaneByTexture();
            });
            break;
    }}else if(whichpanel=='right'){
        switch (pagedata.operation) {
            case 'obj-add':
                // 对于清单中的每一项，触发点击事件click
                $('#rightclist').children().click(function () {
                    showmesg(this.uuid);
                    showmesg(this.path + ' ' + this.filename + ' ' + this.typename);
                    // 首先清除SELECT_IN_MENU的已有对象
                    SELECT_IN_MENU = {};
                    // 向SELECT_IN_MENU中写入新的对象信息
                    SELECT_IN_MENU.uuid = this.uuid;
                    SELECT_IN_MENU.typename = this.typename;
                    SELECT_IN_MENU.path = this.path;
                    SELECT_IN_MENU.filename = this.filename;
                    console.log('obj-add测试右边菜单！！！！！');
                    console.log(SELECT_IN_MENU);

                    if (this.supportingface) {
                        SELECT_IN_MENU.supportingface = this.supportingface;
                    }
                    // 此时，等待用户点选下一个位置，如果点选的下一个位置是支撑面的位置，则放置家具。
                });
                break;
            case 'surfaceplane-add':
                // 对于清单中的每一项，触发点击事件click
                $('#rightclist').children().click(function () {
                    showmesg(this.uuid);
                    showmesg(this.path + ' ' + this.filename + ' ' + this.typename);
                    // 首先清除SELECT_IN_MENU的已有对象
                    SELECT_IN_MENU = {};
                    // 向SELECT_IN_MENU中写入新的对象信息
                    SELECT_IN_MENU.imageURL = this.imageURL;
                    SELECT_IN_MENU.typename = this.typename;
                    if (this.supportingface) {
                        SELECT_IN_MENU.supportingface = this.supportingface;
                    }
                    // 此时，等待用户点选下一个位置，如果点选的下一个位置是支撑面的位置，则放置家具。
                });
                break;
            case 'light-add':
                // 对于清单中的每一项，触发点击事件click
                $('#rightclist').children().click(function () {
                    // 首先清除SELECT_IN_MENU的已有对象
                    SELECT_IN_MENU = {};
                    // 向SELECT_IN_MENU中写入新的对象信息
                    SELECT_IN_MENU.uuid = this.uuid;
                    SELECT_IN_MENU.typename = this.typename;
                    SELECT_IN_MENU.supportingface = this.supportingface;
                    // 此时，等待用户点选下一个位置，如果点选的下一个位置是支撑面的位置，则放置家具。
                });
                break;
            case 'window-texture':
            case 'door-texture':
                $('#rightclist').children().click(function () {
                    SELECTED_FOR_SETTING.imageURL = this.imageURL;
                    console.log('door-texture测试右边菜单！！！！');
                    console.log('门窗'+SELECTED_FOR_SETTING.name+'的位置是'+SELECTED_FOR_SETTING.position.x+" "+SELECTED_FOR_SETTING.position.z);
                    console.log(SELECTED_FOR_SETTING.imageURL);
                    console.log(SELECTED_FOR_SETTING);

                    var strData=sessionStorage.getItem(SELECTED_FOR_SETTING.name);
                    var jsData=JSON.parse(strData);
                    jsData.src=SELECTED_FOR_SETTING.imageURL;
                    var finalData=JSON.stringify(jsData);
                    sessionStorage.setItem(SELECTED_FOR_SETTING.name,finalData);

                    console.log('最后的修改！！！！！');


                    showmesg(SELECTED_FOR_SETTING.imageURL);
                    updateSurfacePlaneByTexture();
                });
                break;
            case 'floor-texture':
            case 'wall-texture':
                $('#rightclist').children().click(function () {
                    SELECTED_FOR_SETTING.imageURL = this.imageURL;
                    console.log('floor-wall-texture右边菜单测试！！！！！');
                    console.log('墙和地板'+SELECTED_FOR_SETTING.name+' 的位置是:'+SELECTED_FOR_SETTING.position.x+" "+SELECTED_FOR_SETTING.position.z);
                    console.log(SELECTED_FOR_SETTING.imageURL);
                    console.log(SELECTED_FOR_SETTING);

                    if(SELECTED_FOR_SETTING.typename!=='floor') {
                        var change = sessionStorage.getItem(SELECTED_FOR_SETTING.name);
                        var after = JSON.parse(change);
                        after.src = SELECTED_FOR_SETTING.imageURL;
                        var final = JSON.stringify(after);
                        sessionStorage.setItem(SELECTED_FOR_SETTING.name, final);
                        console.log(after);
                    }else{
                        var floorData={
                            type:'floor',
                            src:SELECTED_FOR_SETTING.imageURL
                        };
                        var floorStr=JSON.stringify(floorData);
                        sessionStorage.setItem('floor',floorStr);
                        console.log('地板成功！！！！1');

                    }

                    showmesg(SELECTED_FOR_SETTING.imageURL);
                    updatePlaneByTexture();
                });
                break;
        }
    }
}

/* 根据添加的对象，把对象放到场景中
 * path: OBJ模型所在的URL路径
 * filename: OBJ模型的文件名称
 * typename: 加载模型的类型
 * 重要提醒：OBJ文件的名称必须与MTL文件的名称相同（扩展名除外）。
 */
function loadObject(path, filename, typename, location, supportingFace) {
    "use strict";
    // 从URL加载OBJ模型
    // 不能拾取加载OBJ模型的问题，在render()函数中解决。
    // 如果url和typename这两个参数中，任意一个为空
    if ((typeof path) !== 'string' || (typeof filename) !== 'string' || (typeof typename) !== 'string') {
        showmesg('addObjectToScene()：参数错误', true);
        return;
    }
    // 使用LoadingManager，处理载入带来的问题
    // 定义在three.js中
    var manager = new THREE.LoadingManager();
    // 载入过程中发生错误
    manager.onError = function (xhr) {
        showmesg('manager.onError：模型载入错误', true);
    };
    // 实时反馈载入过程
    manager.onProgress = function (xhr) {
        if (xhr.lengthComputable) {
            var percentComplete = Math.round(xhr.loaded / xhr.total * 100, 2);
            showmesg('模型载入中，已完成' + percentComplete + '%');
        }
    };
    // 当所有的模型载入完成时
    manager.onLoad = function (xhr) {
    };
    // 新建OBJ模型装载器
    var mtlloader = new THREE.MTLLoader(manager);
    // 智能修正路径格式
    var lastChar = path.charAt(path.length - 1);
    if (lastChar !== '/') {
        path += '/';
    }
    if (filename.charAt(0) === '/') {
        filename = filename.slice(1, filename.length);
    }
    var extension = filename.slice(filename.length - 4, filename.length);
    if (extension === '.obj' || extension === '.mtl') {
        filename = filename.slice(0, filename.length - 4);
    }
    window.console.log('is loading');
    mtlloader.setPath(path);
    mtlloader.load(filename + '.mtl', function (materials) {
        // 纹理贴图预加载
        materials.preload();
        // MTL装载器和OBJ装载器都使用同一个装载管理器manager
        var objLoader = new THREE.OBJLoader(manager);
        objLoader.setMaterials(materials);
        objLoader.setPath(path);
        objLoader.load(filename + '.obj', function (loadedMesh) {
            // 旧的OBJ装载器使用的代码
            // var chair_material = new THREE.MeshLambertMaterial({color: 0x5c3a21});
            // loadedMesh.children.forEach(function (child) {
            //     child.material = chair_material;
            //     child.geometry.computeFaceNormals();
            //     child.geometry.computeVertexNormals();
            // });
            var scale = 0.04;
            loadedMesh.scale.set(scale, scale, scale);
            if (location === undefined) {
                // 注意，这里切不可使用“var location”进行重复声明
                location = new THREE.Vector3(0, 0, 0);
            }
            loadedMesh.position.copy(location);
            loadedMesh.typename = typename;
            loadedMesh.path = path;
            loadedMesh.filename = filename;
            loadedMesh.supportingFace = supportingFace;
            loadedMesh.castShadow = true;

            loadedMesh.name=typename+IDCount;
            IDCount++;

            scene.add(loadedMesh);
        });

    });
    // 如果已经有一个从菜单栏中选取出来的对象，需要释放
    if (SELECT_IN_MENU) {
        SELECT_IN_MENU = null;
    }
}



var DEFAULT_SURFACEPLANE_SIZE = {
    width: 5,
    height: 5
};
// 从菜单中添加对象
// 这个函数应该由家具列表的列表项的鼠标单击事件触发
// 必备参数：对象的类型，对象的URL位置（如果是OBJ模型）
function addObjectInMenu(supportingFace) {
    "use strict";
    var i;
    // 如果不是支撑面，不能添加
    if (!isSupportingFace(supportingFace)) {
        popup.showPopup('您必须将家具添加到支撑平面上。');
        return;
    }
    // 如果定义了添加对象到哪一种平面，则执行判断
    if (SELECT_IN_MENU.supportingface) {
        if (supportingFace.typename !== SELECT_IN_MENU.supportingface) {
            window.console.log(supportingFace.typename);
            window.console.log(SELECT_IN_MENU.supportingface);
            popup.showPopup('您不能将家具放到这种平面上。');
            return ;
        }
    }
    /* Plane( normal, constant )
     * normal -- (Vector3) normal vector defining the plane pointing towards the origin
     * constant -- (Float) the negative distance from the origin to the plane along the normal vector
     */
    var curPlane = new THREE.Plane();
    generateMathPlane(supportingFace, curPlane);
    window.console.log('now is adding');
    if (rayCaster && rayCaster.ray) {
        var intersectionPoint = new THREE.Vector3();
        if (rayCaster.ray.intersectPlane(curPlane, intersectionPoint)) {
            // 开始添加对象
            switch (SELECT_IN_MENU.typename) {
                case 'spotlight-upward':
                    hLight.createSpotLight(intersectionPoint, supportingFace, 1);
                    break;
                case 'spotlight-downward':
                    hLight.createSpotLight(intersectionPoint, supportingFace, -1);
                    break;
                case hDoObj.TYPE_FRIENDLY_NAME.SURFACE_PLANE:
                    createSurfacePlane(supportingFace, intersectionPoint, false, DEFAULT_SURFACEPLANE_SIZE.width, DEFAULT_SURFACEPLANE_SIZE.height, hDoObj.TYPE_FRIENDLY_NAME.SURFACE_PLANE, SELECT_IN_MENU.imageURL,SELECT_IN_MENU.leftPoint,SELECT_IN_MENU.rightPoint);
                    console.log(SELECT_IN_MENU);
                    console.log('调试壁画！！！！！');
                    break;
                default:
                    loadObject(SELECT_IN_MENU.path, SELECT_IN_MENU.filename, SELECT_IN_MENU.typename, intersectionPoint, supportingFace);
                    break;
            }

            // 对象添加完成！释放已经选择的要添加的对象SELECT_IN_MENU
            SELECT_IN_MENU = null;
        } else {
            showmesg('错误！找不到相交的点！', true);
        }
    } else {
        showmesg('错误！参数raycaster.ray未定义。', true);
    }
}

// 判断用户点选的是不是一个支撑面
function isSupportingFace(object3d) {
    "use strict";
    var ret = false;
    // 判断是不是Object3D对象，也判断是否有定义
    if (object3d instanceof THREE.Object3D) {
        // 判断是不是Mesh对象
        if (object3d instanceof THREE.Mesh) {
            // 判断是否是支撑面的合法类型，有地面、墙面和天花板三种
            if (object3d.typename === hDoObj.TYPE_FRIENDLY_NAME.FLOOR || object3d.typename ===
                hDoObj.TYPE_FRIENDLY_NAME.WALL || object3d.typename === hDoObj.TYPE_FRIENDLY_NAME.CEILING) {
                ret = true;
            }
        }
    }
    return ret;
}

// 地板的法向量
// var FLOOR_NORMAL = new THREE.Vector3(0, 1, 0);
// 考虑到平面在三维空间中旋转的方向有两种，上述描述旋转的法向量是错误的，必须采用下面的法向量
var FLOOR_NORMAL = new THREE.Vector3(0, -1, 0);
// 天花板的法向量
var CEILING_NORMAL = new THREE.Vector3(0, -1, 0);
// 地板的默认颜色
var DEFAULT_FLOOR_COLOR = 0xA2A2A2;
// 默认的地板砖重复次数
var DEFAULT_FLOOR_REPEAT = 0.0625;
// 天花板的默认颜色
var DEFAULT_CEILING_COLOR = 0xE8E8E8;
// 加载地板和天花板（外部加载纹理贴图）：成对地创建地板和天花板
/* 参数说明：
 * centerPos: 二维数组，表示中心位置
 * verticesList: 多边形的每一个顶点，顶点用二维数组表示
 * 其他选项在options中给出：
 * floorMaterial: 地板材质，使用MATERIAL_TYPE定义
 * ceilingMaterial: 天花板材质，使用MATERIAL_TYPE定义
 * floorFill: 地板填充，颜色用十六进制数值表示，填充纹理图片用string表示
 * ceilingFill：天花板填充，颜色用十六进制数值表示，填充纹理图片用string表示
 */
function loadFloorAndCeiling(centerPos, verticesList, options, drawCeiling) {
    "use strict";
    var i;
    if (!Array.isArray(verticesList)) {
        showmesg('pointsList不是数组', true);
        return;
    }
    if (!Array.isArray(centerPos)) {
        showmesg('centerPos不是数组', true);
        return;
    }
    if (typeof drawCeiling === 'undefined') {
        drawCeiling = true;
    }
    if (typeof drawCeiling !== 'boolean') {
        showmesg('drawCeiling不是布尔变量', true);
        return;
    }
    // 建立一个Vector2类型的路径数组
    var path = [];
    for (i = 0; i < verticesList.length; i++) {
        path.push(new THREE.Vector2(verticesList[i][0], verticesList[i][1]));
    }
    var lastVertex = verticesList[verticesList.length - 1];
    var firstVertex = verticesList[0];
    // 如果收尾不能相接，需要将首尾连接起来
    if (firstVertex[0] !== lastVertex[0] || firstVertex[1] !== lastVertex[1]) {
        path.push(new THREE.Vector2(firstVertex[0], firstVertex[1]));
    }
    // 利用路径数组创建一个新的形状，然后利用形状来创建一个新的ShapeGeometry对象。
    var shape = new THREE.Shape(path);
    var geometry = new THREE.ShapeGeometry(shape);
    // 处理可选项：表面材质和纹理填充
    var floorOptions = {
        side: THREE.DoubleSide,
        color: DEFAULT_FLOOR_COLOR
    };
    var ceilingOptions = {
        side: THREE.DoubleSide,
        color: DEFAULT_CEILING_COLOR
    };
    var floorMaterial;
    var ceilingMaterial;
    // 任何对象的材质都不要选择MeshBasicMaterial类型，不然在选取对象的过程中会遇到错误。
    if (options) {
        /* floorMaterial: 地板材质，使用MATERIAL_TYPE定义
         * ceilingMaterial: 天花板材质，使用MATERIAL_TYPE定义
         * floorFill: 地板填充纹理图片
         * ceilingFill：天花板填充纹理图片
         */
        if (typeof options.floorFill !== 'string') {
            options.floorFill = 'images/materials/white.jpg';
        }
        var texture_floor = new THREE.TextureLoader().load( options.floorFill );
        texture_floor.wrapS = THREE.RepeatWrapping;
        texture_floor.wrapT = THREE.RepeatWrapping;
        texture_floor.repeat.set( DEFAULT_FLOOR_REPEAT, DEFAULT_FLOOR_REPEAT );
        floorOptions.map = texture_floor;
        
        switch (options.floorMaterial) {
            case MATERIAL_TYPE.LAMBERT:
                floorMaterial = new THREE.MeshLambertMaterial(floorOptions);
                break;
            default:
                floorMaterial = new THREE.MeshPhongMaterial(floorOptions);
                break;
        }

        if (typeof options.ceilingFill !== 'string') {
            options.ceilingFill = 'images/materials/white.jpg';
        }
        var texture_ceiling = new THREE.TextureLoader().load( options.ceilingFill );
        texture_ceiling.wrapS = THREE.RepeatWrapping;
        texture_ceiling.wrapT = THREE.RepeatWrapping;
        texture_ceiling.repeat.set( DEFAULT_FLOOR_REPEAT, DEFAULT_FLOOR_REPEAT );
        ceilingOptions.map = texture_ceiling;
        
        switch (options.ceilingMaterial) {
            case MATERIAL_TYPE.LAMBERT:
                ceilingMaterial = new THREE.MeshLambertMaterial(ceilingOptions);
                break;
            default:
                ceilingMaterial = new THREE.MeshPhongMaterial(ceilingOptions);
                break;
        }
    } else {
        floorMaterial = new THREE.MeshPhongMaterial(floorOptions);
        ceilingMaterial = new THREE.MeshPhongMaterial(ceilingOptions);
    }
    // 构建Mesh，并标记
    var floorMesh = new THREE.Mesh(geometry, floorMaterial);
    var ceilingMesh = new THREE.Mesh(geometry, ceilingMaterial);
    floorMesh.typename = hDoObj.TYPE_FRIENDLY_NAME.FLOOR;
    ceilingMesh.typename = hDoObj.TYPE_FRIENDLY_NAME.CEILING;
    // 设置地板的位置和方向
    var pos = new THREE.Vector3(centerPos[0], 0, centerPos[1]);
    floorMesh.position.copy(pos);
    // 构造地板的法向量
    var normal = new THREE.Vector3();
    normal.copy(pos).add(FLOOR_NORMAL);
    // 使用Object3D类的lookAt(v)方法指定平面的一个从position到v的一个法向量
    floorMesh.lookAt(normal);
    // 设置天花板的位置和方向
    pos.y = room.height;
    ceilingMesh.position.copy(pos);
    // 构造天花板的法向量
    normal.copy(pos).add(CEILING_NORMAL);
    ceilingMesh.lookAt(normal);
    // 接受阴影，并且添加到场景
    floorMesh.receiveShadow = true;
    ceilingMesh.receiveShadow = true;
    // 为了动态调整纹理
    floorMesh.imageURL = options.floorFill;
    floorMesh.imageRepeatX = DEFAULT_FLOOR_REPEAT;
    floorMesh.imageRepeatY = DEFAULT_FLOOR_REPEAT;
    ceilingMesh.imageURL = options.ceilingFill;
    ceilingMesh.imageRepeatX = DEFAULT_FLOOR_REPEAT;
    ceilingMesh.imageRepeatY = DEFAULT_FLOOR_REPEAT;
    floorMesh.hexColor = {};
    floorMesh.hexColor.r = Math.floor(floorMesh.material.color.r * 255);
    floorMesh.hexColor.g = Math.floor(floorMesh.material.color.g * 255);
    floorMesh.hexColor.b = Math.floor(floorMesh.material.color.b * 255);
    ceilingMesh.hexColor = {};
    ceilingMesh.hexColor.r = Math.floor(ceilingMesh.material.color.r * 255);
    ceilingMesh.hexColor.g = Math.floor(ceilingMesh.material.color.g * 255);
    ceilingMesh.hexColor.b = Math.floor(ceilingMesh.material.color.b * 255);
    scene.add(floorMesh);
    if (drawCeiling) {
        scene.add(ceilingMesh);
    }
}

// 加载设置地板颜色的面板，函数由json文件中的点击调用，在mouseclick中加载了这个json文件。
// 调用这个函数的时候，地板对象已经存放在SELECTED_FOR_SETTING中。
function loadUpdateFloorByColor() {
    "use strict";
    var location = 'json/pagedata/floor-color.json';
    $.get(location, function (data, status) {
        if (status === 'success') {
            // popup.showPopup('成功获取JSON文件：' + location);
        } else {
            showmesg('获取JSON文件(' + location + ')失败', true);
        }
        parseSidePanelPageData(data,'right');
    });
    updatePlaneByColor();
}
function updatePlaneByColor() {
    "use strict";
    SELECTED_FOR_SETTING.material.color.r = SELECTED_FOR_SETTING.hexColor.r / 255;
    SELECTED_FOR_SETTING.material.color.g = SELECTED_FOR_SETTING.hexColor.g / 255;
    SELECTED_FOR_SETTING.material.color.b = SELECTED_FOR_SETTING.hexColor.b / 255;
}

// 加载设置地板纹理图片的面板
function loadUpdatePlaneByTexture(typename) {
    "use strict";
    var location = 'json/pagedata/' + typename + '-texture.json';
    $.get(location, function (data, status) {
        if (status === 'success') {
            popup.showPopup('成功更换板材');
        } else {
            showmesg('获取JSON文件(' + location + ')失败', true);
        }
        parseSidePanelPageData(data,'right');
    });
}
function updatePlaneByTexture() {
    "use strict";
    var texture = new THREE.TextureLoader().load( SELECTED_FOR_SETTING.imageURL );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set( SELECTED_FOR_SETTING.imageRepeatX, SELECTED_FOR_SETTING.imageRepeatY );
    SELECTED_FOR_SETTING.material.map = texture;
    // SELECTED_FOR_SETTING.material = new THREE.MeshPhongMaterial({color: DEFAULT_FLOOR_COLOR, map: texture});
    showmesg('刷新纹理');
    SELECTED_FOR_SETTING.updateMorphTargets();
    SELECTED_FOR_SETTING.updateMatrixWorld();
}
function loadModifyPlane(typename) {
    "use strict";
    var location = 'json/pagedata/' + typename + '-modify.json';
    $.get(location, function (data, status) {
        if (status === 'success') {
            switch(typename) {
                case hDoObj.TYPE_FRIENDLY_NAME.FLOOR:
                    popup.showPopup('选中了地板');
                    break;
                case hDoObj.TYPE_FRIENDLY_NAME.CEILING:
                    popup.showPopup('选中了天花板');
                    break;
                case hDoObj.TYPE_FRIENDLY_NAME.WALL:
                    popup.showPopup('选中了墙壁');
                    break;
            }
        } else {
            showmesg('获取JSON文件(' + location + ')失败', true);
        }
        parseSidePanelPageData(data,'right');
    });

}

// 默认墙纸路径
var DEFAULT_WALL_IMAGE = 'images/materials/wall_6.jpg';
// 墙壁的默认颜色
var DEFAULT_WALL_COLOR = 0xffffff;
// 绘制一个单一墙壁
// 如果leftDistance等于rightDistance，或者isDoor不是布尔型变量，则不绘制孔洞
function drawSingleWall(leftWallVertex, rightWallVertex, leftDistance, rightDistance, isDoor) {
    "use strict";
    var i;
    // （1）以中点位置为原点，(-x, 0, 0)和(x, 0, 0)为两个端点绘制一个平面。
    var orientation = new THREE.Vector2();
    var leftPoint = new THREE.Vector2(leftWallVertex[0], leftWallVertex[1]);
    var rightPoint = new THREE.Vector2(rightWallVertex[0], rightWallVertex[1]);
    orientation.copy(rightPoint).sub(leftPoint);
    var length = orientation.length();
    var angle_radian = -Math.atan(orientation.y / orientation.x);
    var middlePoint = new THREE.Vector2();
    middlePoint.copy(leftPoint).add(rightPoint).multiplyScalar(0.5);
    // 有一种情况会导致孔洞无法被绘制：当形状轮廓和孔洞轮廓都是顺时针绘制的时候
    // 墙壁THREE.Shape的四个点，顺时针绘制
    // 原因不明，如果不使用moveTo和lineTo语法创建形状Shape和路径Path，会造成无法绘制孔洞hole的错误
    var shape_wall = new THREE.Shape();
    shape_wall.moveTo(-length / 2, 0);
    shape_wall.lineTo(-length / 2, room.height);
    shape_wall.lineTo(length / 2, room.height);
    shape_wall.lineTo(length / 2, 0);
    if (leftDistance !== rightDistance && (typeof isDoor === 'boolean')) {
        // 绘制孔洞，然后将这个THREE.Path孔洞放入THREE.Shape墙壁形状的属性holes数组中
        // 可能是由于算法自身的漏洞，绘制的两个孔洞如果有相连或者重叠的部分，会出现错误
        var hole = new THREE.Path();
        // 孔洞的四个点，逆时针绘制
        if (isDoor) {
            // 孔洞是门
            hole.moveTo((-length / 2 + rightDistance), 0);
            hole.lineTo((-length / 2 + rightDistance), room.doorTop);
            hole.lineTo((-length / 2 + leftDistance), room.doorTop);
            hole.lineTo((-length / 2 + leftDistance), 0);
        } else {
            // 孔洞是窗户
            hole.moveTo((-length / 2 + rightDistance), room.windowBottom);
            hole.lineTo((-length / 2 + rightDistance), room.windowTop);
            hole.lineTo((-length / 2 + leftDistance), room.windowTop);
            hole.lineTo((-length / 2 + leftDistance), room.windowBottom);
        }
        shape_wall.holes.push(hole);
    }
    // （2）设置相关属性。
    var texture_wall = new THREE.TextureLoader().load( DEFAULT_WALL_IMAGE );
    texture_wall.wrapS = THREE.RepeatWrapping;
    texture_wall.wrapT = THREE.RepeatWrapping;
    texture_wall.repeat.set( DEFAULT_FLOOR_REPEAT, DEFAULT_FLOOR_REPEAT );
    var mat_wall = new THREE.MeshPhongMaterial({color: DEFAULT_WALL_COLOR, map: texture_wall, side: THREE.DoubleSide});
    var shapeGeo_wall = new THREE.ShapeGeometry(shape_wall);
    var wall = new THREE.Mesh(shapeGeo_wall, mat_wall);
    wall.typename = hDoObj.TYPE_FRIENDLY_NAME.WALL;
    wall.receiveShadow = true;
    wall.leftPoint = leftPoint;
    wall.rightPoint = rightPoint;
    // 设置墙壁的一个法向量
    var alpha = Math.atan(-orientation.x / orientation.y);
    wall.normalvector = new THREE.Vector3(Math.cos(alpha), 0, Math.sin(alpha));
    // 查找一个地板来作为支撑面
    for (i = 0; i < scene.children.length; i++) {
        if (scene.children[i].typename === hDoObj.TYPE_FRIENDLY_NAME.FLOOR) {
            wall.supportingFace = scene.children[i];
            break;
        }
    }
    // 重要提醒：正确顺序是，先平移，再旋转
    // （3）平移。
    wall.translateX(middlePoint.x);
    wall.translateZ(middlePoint.y);
    // （4）按照角度旋转平面。
    wall.rotateY(angle_radian);
    // 为了动态调整纹理
    wall.imageURL = DEFAULT_WALL_IMAGE;
    wall.imageRepeatX = DEFAULT_FLOOR_REPEAT;
    wall.imageRepeatY = DEFAULT_FLOOR_REPEAT;
    wall.hexColor = {};
    wall.hexColor.r = Math.floor(wall.material.color.r * 255);
    wall.hexColor.g = Math.floor(wall.material.color.g * 255);
    wall.hexColor.b = Math.floor(wall.material.color.b * 255);
    wall.name='wall'+WallCount;
    scene.add(wall);

    WallCount++;
    console.log(wall.name+'建好了！！！');
    var wallData={
        type:'wall',
        x1:leftWallVertex[0],
        y1:leftWallVertex[1],
        x2:rightWallVertex[0],
        y2:rightWallVertex[1],
        src:wallURL

    }
    var strwall=JSON.stringify(wallData);
    console.log(strwall);

    sessionStorage.setItem(wall.name,strwall);
}

var DEFAULT_SURFACE_IMAGE = 'images/materials/green.jpg';
var DEFAULT_WINDOW_IMAGE = 'images/window/win4.JPG';
var DEFAULT_DOOR_IMAGE = 'images/door/door5.JPG';
var DEFAULT_SURFACE_PLANE = {
    width: 3,
    height: 3,
    depth: 0.05,
    color: 0xdddddd
    // color: 0x00dd00
};
// 创建在表面上的平面
/* 参数：
 * supportingFace - 支撑面
 * intersectedPoint - 射线与支撑面的交点
 * isHole - 是否作为填充孔洞的表面平面。对于门和窗户，这个参数应该设为true；对于一般的挂饰，这个参数应该设为false
 */
function createSurfacePlane(supportingFace, intersectedPoint, isHole, width, height, typename, image,leftpoint,rightPoint) {
    "use strict";
    if (!(supportingFace instanceof THREE.Object3D) || !(intersectedPoint instanceof THREE.Vector3)) {
        showmesg('参数错误！', true);
        return;
    }
    if (typeof isHole !== 'boolean') {
        isHole = false;
    }
    if (typeof width !== 'number') {
        width = DEFAULT_SURFACE_PLANE.width;
    }
    if (typeof height !== 'number') {
        height = DEFAULT_SURFACE_PLANE.height;
    }
    var imgloc;
    // 如果已经定义了一个贴图文件
    if (image!=='null') {
        imgloc = image;
    } else {
        switch (typename) {
            case hDoObj.TYPE_FRIENDLY_NAME.DOOR:
                imgloc = DEFAULT_DOOR_IMAGE;
                break;
            case hDoObj.TYPE_FRIENDLY_NAME.WINDOW:
                imgloc = DEFAULT_WINDOW_IMAGE;
                break;
            default:
                imgloc = DEFAULT_SURFACE_IMAGE;
                break;
        }
    }
    var texture_sp = new THREE.TextureLoader().load( imgloc );
    /* BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments)
     * width, height, depth 分别是X轴、Y轴、Z轴方向上的长度
     */
    var geo_sp = new THREE.BoxGeometry( width, height, DEFAULT_SURFACE_PLANE.depth );
    var mat_sp = new THREE.MeshPhongMaterial( {color: DEFAULT_SURFACE_PLANE.color, map: texture_sp} );
    var sp = new THREE.Mesh( geo_sp, mat_sp );
    if (typename === null || typename === undefined) {
        sp.typename = hDoObj.TYPE_FRIENDLY_NAME.SURFACE_PLANE;
    } else {
        sp.typename = typename;
    }
    sp.spwidth = width;
    sp.spheight = height;
    sp.supportingFace = supportingFace;
    var normalvector = new THREE.Vector3();
    // 支撑面的类型可能有地面、墙壁和天花板三种
    switch (supportingFace.typename) {
        case hDoObj.TYPE_FRIENDLY_NAME.FLOOR:
            sp.rotateX(Math.PI / 2);
            break;
        case hDoObj.TYPE_FRIENDLY_NAME.WALL:
            normalvector = supportingFace.normalvector;
            var alpha_radian = Math.atan(normalvector.x / normalvector.z);
            sp.rotateY(alpha_radian);
            break;
        case hDoObj.TYPE_FRIENDLY_NAME.CEILING:
            sp.rotateX(Math.PI / 2);
            break;
    }
    if (isHole) {
        // 如果是用来作为填充孔洞的对象，即门或者窗户，直接平移到交点就可以了
        sp.position.copy(intersectedPoint);
    } else {
        // 如果不是用来作为填充孔洞的对象，那么必须精确控制移动的位置，否则会在两边都能看到这个图像
        // 处理的公式是 WO = WI + IO = WI + |IO|/|IC|*IC，O是表面平面的几何中心，I是射线ray与支撑面交点，C是相机位置，W是世
        // 界坐标的中心。
        var O = new THREE.Vector3();
        var I = new THREE.Vector3();
        var C = new THREE.Vector3();
        C.copy(camera.position);
        I.copy(intersectedPoint);
        // C在选定支撑面的投影是H，sin(alpha)=|CH|/|CI|=|OH'|/|OI|
        var curPlane = new THREE.Plane();
        generateMathPlane(supportingFace, curPlane);
        var CH_length = curPlane.distanceToPoint(C);
        var IC = new THREE.Vector3();
        IC.copy(C).sub(I);
        var CI_length = IC.length();
        var small_number = 0.01;
        var IO_length = CI_length * (DEFAULT_SURFACE_PLANE.depth / 2 + small_number) / CH_length;
        IC.multiplyScalar(Math.abs(IO_length/CI_length));
        O.copy(I).add(IC);
        sp.position.copy(O);
    }

    // 为了动态调整纹理
    sp.imageURL = imgloc;
    sp.hexColor = {};
    sp.hexColor.r = Math.floor(sp.material.color.r * 255);
    sp.hexColor.g = Math.floor(sp.material.color.g * 255);
    sp.hexColor.b = Math.floor(sp.material.color.b * 255);

    sp.name=sp.typename.substring(12)+spCount;
    sp.type=sp.typename.substring(12);

    spCount++;
    console.log();
    console.log('门窗'+sp.name+'被创建!!!!!!!!');
    console.log('支撑面！！！！！1');
    console.log(supportingFace);
    if(typename!==hDoObj.TYPE_FRIENDLY_NAME.SURFACE_PLANE) {
        console.log(rightPoint);
        console.log('位置' + leftpoint.x + " " + leftpoint.y + " " + rightPoint.x + " " + rightPoint.y + ' ' + "材质" + sp.imageURL);
        console.log(sp);//TODO:待定

        var windoorData = {
            type: sp.type,
            x1: leftpoint.x,
            y1: leftpoint.y,
            x2: rightPoint.x,
            y2: rightPoint.y,
            src: sp.imageURL
        };
        var tempData = JSON.stringify(windoorData);
        sessionStorage.setItem(sp.name, tempData);
    }else {

        var surfaceData = {
            type: sp.typename,
            x1: supportingFace.leftPoint.x,
            y1: supportingFace.leftPoint.y,
            x2: supportingFace.rightPoint.x,
            y2: supportingFace.rightPoint.y,
            x3:sp.position.x,
            y3:sp.position.z,
            height:sp.position.y,
            src: sp.imageURL
        };
        var tempdata = JSON.stringify(surfaceData);
        sessionStorage.setItem(sp.typename+spCount, tempdata);
        console.log(sp.position.y+"weizhi!!!!!!!!!!");

    }

    //壁画模型偏小，在此调整壁画模型大小
    if(typename==hDoObj.TYPE_FRIENDLY_NAME.SURFACE_PLANE){
        sp.scale.set(7,3.5,3.5);
    }


    scene.add( sp );

    return (sp);
}
function updateSurfacePlaneByTexture() {
    "use strict";
    SELECTED_FOR_SETTING.material.map = new THREE.TextureLoader().load( SELECTED_FOR_SETTING.imageURL );
    SELECTED_FOR_SETTING.updateMorphTargets();
    SELECTED_FOR_SETTING.updateMatrixWorld();
}
// 按照新的参数，重新创建一个表面平面
function resetSurfacePlane() {
    "use strict";
    if (SELECTED_FOR_SETTING.typename !== hDoObj.TYPE_FRIENDLY_NAME.SURFACE_PLANE && SELECTED_FOR_SETTING.typename !==
        hDoObj.TYPE_FRIENDLY_NAME.WINDOW && SELECTED_FOR_SETTING.typename !== hDoObj.TYPE_FRIENDLY_NAME.DOOR) {
        showmesg('参数错误！', true);
        showmesg(SELECTED_FOR_SETTING.typename);
        return;
    }
    var pos = new THREE.Vector3();
    pos.copy(SELECTED_FOR_SETTING.position);
    var width = SELECTED_FOR_SETTING.spwidth;
    var height = SELECTED_FOR_SETTING.spheight;
    var tn = SELECTED_FOR_SETTING.typename;
    var imageloc = SELECTED_FOR_SETTING.imageURL;
    var newSp = createSurfacePlane(SELECTED_FOR_SETTING.supportingFace, pos, true, width, height, tn, imageloc);
    scene.remove(SELECTED_FOR_SETTING);
    SELECTED_FOR_SETTING = newSp;
}

var STARS = {
    width: 3000,
    segments: 256
};
// 生成暗夜的星空背景
function starsBackground() {
    "use strict";
    var texture_stars = new THREE.TextureLoader().load( 'images/materials/stars.jpg' );
    var geo_stars = new THREE.BoxGeometry( STARS.width, STARS.width, STARS.width );
    // var geo_stars = new THREE.CylinderGeometry( STARS.width, STARS.width, STARS.width, STARS.segments );
    // var geo_stars = new THREE.SphereGeometry( STARS.width, STARS.segments, STARS.segments );
    var mat_stars = new THREE.MeshPhongMaterial( {color: 0xffffff, map: texture_stars, side: THREE.DoubleSide} );
    var stars = new THREE.Mesh( geo_stars, mat_stars );
    stars.typename = hDoObj.TYPE_FRIENDLY_NAME.BACKGROUND;
    scene.add(stars);
}

// 地板的法向量
var FLOOR_NORMAL_2 = new THREE.Vector3(0, 1, 0);
// 天花板的法向量
var CEILING_NORMAL_2 = new THREE.Vector3(0, -1, 0);
// 从选定的几何平面planeGeometry（在WebGL中渲染呈现的）产生结构平面mathPlane（一种THREE.Plane的数据结构）
function generateMathPlane(planeGeometry, mathPlane) {
    "use strict";
    // 如果不是支撑面，不能产生结构平面
    if (!isSupportingFace(planeGeometry)) {
        showmesg('不是支撑面', true, true);
    }
    if (!(mathPlane instanceof THREE.Plane)) {
        showmesg('mathPlane类型错误！');
    }
    switch (planeGeometry.typename) {
        case hDoObj.TYPE_FRIENDLY_NAME.FLOOR:
            mathPlane.setFromNormalAndCoplanarPoint(FLOOR_NORMAL_2, planeGeometry.position);
            break;
        case hDoObj.TYPE_FRIENDLY_NAME.WALL:
            if (planeGeometry.normalvector) {
                mathPlane.setFromNormalAndCoplanarPoint(planeGeometry.normalvector, planeGeometry.position);
            } else {
                showmesg('墙壁的平面法向量没有定义', true);
                return;
            }
            break;
        case hDoObj.TYPE_FRIENDLY_NAME.CEILING:
            mathPlane.setFromNormalAndCoplanarPoint(CEILING_NORMAL_2, planeGeometry.position);
            // showmesg('y=' + planeGeometry.position.y);
            break;
    }
    // showmesg('supportingFace: ' + planeGeometry.typename, true);
    if (!mathPlane) {
        showmesg('mathPlane仍未定义', true, true);
    }
}



// 用于实现数据绑定
function NumberBind(varToBind, min, max, step, precision, callback) {
    "use strict";
    // 处理callback参数
    if (typeof callback !== 'function') {
        if (typeof callback === 'string') {
            this._callback = function (value) {
                eval(callback);
            };
        } else {
            if (typeof varToBind !== 'string') {
                showmesg('没有正确指定要绑定的对象名', true);
                return;
            }
            this._callback = function (value) {
            };
        }
    } else {
        this._callback = callback;
    }
    this._value = eval(varToBind);
    this._min = min || 0;
    this._max = max || 100;
    this._step = step || 0.1;
    this._precision = precision || 1;
    this.domElement = document.createElement('input');
    this.domElement.setAttribute('type', 'number');
    this.domElement.setAttribute('min', this._min);
    this.domElement.setAttribute('max', this._max);
    this.domElement.setAttribute('step', this._step);
    this.domElement.setAttribute('value', this._value);
    this.domElement.parent = this;
    this.domElement.onchange = function () {
        this.parent._value = hTools.roundTo(this.value, this.parent._precision);
        eval(varToBind + ' = this.parent._value;');
        this.parent._callback(this.parent._value);
    };
    this.domElement.onmousewheel = function () {
        this.parent._value = hTools.roundTo(this.value, this.parent._precision);
        eval(varToBind + ' = this.parent._value;');
        this.parent._callback(this.parent._value);
    };
    this.getValue = function () {
        return this._value;
    };
    this.setValue = function (newValue) {
        var retVal = hTools.roundTo(newValue, this._precision);
        this._value = retVal;
        this.domElement.value = retVal;
        this._callback(this._value);
    };
}
