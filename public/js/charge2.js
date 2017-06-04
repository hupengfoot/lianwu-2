var chargeID2 = 'lw-teacher-charge2';
var nameElChargeID2 = document.getElementById(chargeID2);

var firstCharge2 = []; 
var secondCharge2 = []; 

function creatList(obj, list){
  obj.forEach(function(item, index, arr){
  var temp = new Object();
  temp.text = item.name;
  temp.value = index;
  list.push(temp);
  })
}

creatList(chargeTime2, firstCharge2);
creatList(chargeMoney2, secondCharge2);

var selectedIndexCharge2 = [0, 0]; 
var checkedCharge2 = [0, 0]; 

var pickerCharge2 = new Picker({
	data: [firstCharge2, secondCharge2],
  selectedIndex: selectedIndexCharge2,
	title: '期望授课费'
});

pickerCharge2.on('picker.select', function (selectedVal, selectedIndexCharge2) {
  var text1Charge = firstCharge2[selectedIndexCharge2[0]].text;
  var text2Charge = secondCharge2[selectedIndexCharge2[1]].text;
  $("#" + chargeID2).val(text1Charge + ' ' + text2Charge);
});

pickerCharge2.on('picker.change', function (index, selectedIndexCharge2) {
  if (index === 0){
    firstChange();
  } else if (index === 1) {
    secondChange();
  }

  function firstChange() {
    second = [];
    third = [];
    checkedCharge2[0] = selectedIndexCharge2;
  }

  function secondChange() {
    third = [];
    checkedCharge2[1] = selectedIndexCharge2;
  }

});

pickerCharge2.on('picker.valuechange', function (selectedVal, selectedIndexCharge2) {
  console.log(selectedVal);
  console.log(selectedIndexCharge2);
});

nameElChargeID2.addEventListener('click', function () {
	pickerCharge2.show();
});


