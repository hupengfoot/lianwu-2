var dutyID = 'lw-duty-type';
var nameElChargeID = document.getElementById(dutyID);

var firstDuty = []; 

function creatList(obj, list){
  obj.forEach(function(item, index, arr){
  var temp = new Object();
  temp.text = item.name;
  temp.value = index;
  list.push(temp);
  })
}

creatList(dutyType, firstDuty);

var selectedIndexDuty = [0]; 
var checkedDuty = [0]; 

var pickerDuty = new Picker({
	data: [firstDuty],
  selectedIndex: selectedIndexDuty,
	title: '职务类型'
});

pickerDuty.on('picker.select', function (selectedVal, selectedIndexDuty) {
  var text1Duty = firstDuty[selectedIndexDuty[0]].text;
  $("#" + dutyID).val(text1Duty);
});

pickerDuty.on('picker.change', function (index, selectedIndexDuty) {
  if (index === 0){
    firstDuty();
  }

  function firstDuty() {
    checkedDuty[0] = selectedIndexDuty;
  }

});

pickerDuty.on('picker.valuechange', function (selectedVal, selectedIndexDuty) {
  console.log(selectedVal);
  console.log(selectedIndexDuty);
});

nameElChargeID.addEventListener('click', function () {
	pickerDuty.show();
});


