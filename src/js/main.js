$(function(){
  console.log("done")
  WebFont.load({
    active: function() {
      init();
    },
    custom: {
      families: ['monogram'],
      urls: [ './all.css']
    }
  });
});
function init() {
  var elem = document.querySelector('input[type=checkbox]');
  $('input[type=checkbox]').each(function(checkbox){
    var init = new Switchery(this);
  });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera( 30, 1, 1, 1000 );;
  camera.position.z = 89
  scene.add(camera);
  geometry = new THREE.CylinderGeometry(12, 12, 20, 100, 100, true); // Cone

  var texture = new THREE.Texture(renderMonogram("aB3"));
  texture.needsUpdate = true;

  THREE.ImageUtils.crossOrigin = '';
  material = new THREE.MeshBasicMaterial({
    map: texture,
    overdraw: true
  })

  mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.y = 325 * Math.PI / 180;

  scene.add(mesh);
  renderer = new THREE.WebGLRenderer({alpha: true});
  renderer.setClearColor( 0x000000, 0 );
  renderer.setSize(360, 240);
  el = renderer.domElement;
  el.setAttribute("id", "overlay")
  document.body.appendChild(el);
  var f = document.getElementsByClassName("preview")[0];
  f.appendChild(el);
  render();
  animate();

  function renderMonogram(text) {
    var camera, scene, renderer, geometry, material, mesh;
    var text3d;

    var canvas = document.createElement('canvas');;

    canvas.width = 2150;
    canvas.height = 320;
    var ctx = canvas.getContext("2d");
    ctx.font = "400px monogram";
    ctx.fillStyle="#333333";
    var text = "aB3",
        textWidth = ctx.measureText(text).width;
    ctx.fillText(text, -32, 280);
    var f = document.getElementsByClassName("preview")[0];
    return canvas;
  }


  function animate() {
    requestAnimationFrame(animate);
    if($("input[type=checkbox]").is(":checked")) {
      render();
    }
  }

  function render()
  {
    mesh.rotation.y += 0.02;
    renderer.render( scene, camera );
  }
}
