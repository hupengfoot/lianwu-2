var chargeID = 'lw-teacher-charge';
var nameElChargeID = document.getElementById(chargeID);

var firstCharge = []; 
var secondCharge = []; 

function creatList(obj, list){
  obj.forEach(function(item, index, arr){
  var temp = new Object();
  temp.text = item.name;
  temp.value = index;
  list.push(temp);
  })
}

creatList(chargeTime, firstCharge);
creatList(chargeMoney, secondCharge);

var selectedIndexCharge = [0, 0]; 
var checkedCharge = [0, 0]; 

var pickerCharge = new Picker({
	data: [firstCharge, secondCharge],
  selectedIndex: selectedIndexCharge,
	title: '期望授课费'
});

pickerCharge.on('picker.select', function (selectedVal, selectedIndexCharge) {
  var text1Charge = firstCharge[selectedIndexCharge[0]].text;
  var text2Charge = secondCharge[selectedIndexCharge[1]].text;
  $("#" + chargeID).val(text1Charge + ' ' + text2Charge);
});

pickerCharge.on('picker.change', function (index, selectedIndexCharge) {
  if (index === 0){
    firstChange();
  } else if (index === 1) {
    secondChange();
  }

  function firstChange() {
    second = [];
    third = [];
    checkedCharge[0] = selectedIndexCharge;
  }

  function secondChange() {
    third = [];
    checkedCharge[1] = selectedIndexCharge;
  }

});

pickerCharge.on('picker.valuechange', function (selectedVal, selectedIndexCharge) {
  console.log(selectedVal);
  console.log(selectedIndexCharge);
});

nameElChargeID.addEventListener('click', function () {
	pickerCharge.show();
});


