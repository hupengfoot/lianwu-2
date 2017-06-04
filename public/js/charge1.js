var chargeID1 = 'lw-teacher-charge1';
var nameElChargeID1 = document.getElementById(chargeID1);

var firstCharge1 = []; 
var secondCharge1 = []; 

function creatList(obj, list){
  obj.forEach(function(item, index, arr){
  var temp = new Object();
  temp.text = item.name;
  temp.value = index;
  list.push(temp);
  })
}

creatList(chargeTime1, firstCharge1);
creatList(chargeMoney1, secondCharge1);

var selectedIndexCharge1 = [0, 0]; 
var checkedCharge1 = [0, 0]; 

var pickerCharge1 = new Picker({
	data: [firstCharge1, secondCharge1],
  selectedIndex: selectedIndexCharge1,
	title: '期望授课费'
});

pickerCharge1.on('picker.select', function (selectedVal, selectedIndexCharge1) {
  var text1Charge = firstCharge1[selectedIndexCharge1[0]].text;
  var text2Charge = secondCharge1[selectedIndexCharge1[1]].text;
  $("#" + chargeID1).val(text1Charge + ' ' + text2Charge);
});

pickerCharge1.on('picker.change', function (index, selectedIndexCharge1) {
  if (index === 0){
    firstChange();
  } else if (index === 1) {
    secondChange();
  }

  function firstChange() {
    second = [];
    third = [];
    checkedCharge1[0] = selectedIndexCharge1;
  }

  function secondChange() {
    third = [];
    checkedCharge1[1] = selectedIndexCharge1;
  }

});

pickerCharge1.on('picker.valuechange', function (selectedVal, selectedIndexCharge1) {
  console.log(selectedVal);
  console.log(selectedIndexCharge1);
});

nameElChargeID1.addEventListener('click', function () {
	pickerCharge1.show();
});


