import React, { useState } from 'react';
import { Calculator, TrendingUp, Sparkles, DollarSign, PieChart } from 'lucide-react';

export const PfCalculatorView: React.FC = () => {
  const [currentBalance, setCurrentBalance] = useState(125000);
  const [monthlyBasic, setMonthlyBasic] = useState(35000);
  const [annualSalaryHike, setAnnualSalaryHike] = useState(7);
  const [years, setYears] = useState(15);
  const [interestRate, setInterestRate] = useState(8.25);

  const calculateCorpus = () => {
    let balance = currentBalance;
    let basic = monthlyBasic;
    const r = interestRate / 100;
    const hike = annualSalaryHike / 100;

    let totalEmployee = 0;
    let totalEmployer = 0;
    let totalInterest = 0;

    const yearlyData = [];

    for (let yr = 1; yr <= years; yr++) {
      const annualEmp = basic * 0.12 * 12;
      const annualEr = basic * 0.0367 * 12; // 3.67% to EPF
      const deposits = annualEmp + annualEr;

      const interest = (balance + deposits / 2) * r;
      balance += deposits + interest;

      totalEmployee += annualEmp;
      totalEmployer += annualEr;
      totalInterest += interest;

      yearlyData.push({
        year: yr,
        closingBalance: Math.round(balance),
        interest: Math.round(interest),
      });

      basic *= 1 + hike;
    }

    return {
      projectedCorpus: Math.round(balance),
      totalEmployee: Math.round(totalEmployee),
      totalEmployer: Math.round(totalEmployer),
      totalInterest: Math.round(totalInterest),
      yearlyData,
    };
  };

  const results = calculateCorpus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5 text-[#0b3d2e]" />
          <h1 className="text-xl font-bold text-[#12233f]">Future EPF Corpus & Growth Calculator</h1>
        </div>
        <p className="text-xs text-[#4b5f56]">
          Projects your retirement nest-egg using compounding interest (currently 8.25% p.a. as notified by the Central Board of Trustees) and annual career salary increments.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#12233f] pb-2 border-b border-[#e8f2ee]">
            Salary & Contribution Parameters
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-semibold text-[#16251f] mb-1">
                <span>Current EPF Balance</span>
                <span className="text-[#0b3d2e]">₹{currentBalance.toLocaleString('en-IN')}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2000000"
                step="25000"
                value={currentBalance}
                onChange={e => setCurrentBalance(Number(e.target.value))}
                className="w-full accent-[#0b3d2e] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#16251f] mb-1">
                <span>Monthly Basic + DA</span>
                <span className="text-[#0b3d2e]">₹{monthlyBasic.toLocaleString('en-IN')}</span>
              </div>
              <input
                type="range"
                min="15000"
                max="250000"
                step="5000"
                value={monthlyBasic}
                onChange={e => setMonthlyBasic(Number(e.target.value))}
                className="w-full accent-[#0b3d2e] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#16251f] mb-1">
                <span>Expected Annual Salary Hike</span>
                <span className="text-[#0b3d2e]">{annualSalaryHike}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={annualSalaryHike}
                onChange={e => setAnnualSalaryHike(Number(e.target.value))}
                className="w-full accent-[#0b3d2e] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#16251f] mb-1">
                <span>Investment Horizon (Years)</span>
                <span className="text-[#0b3d2e]">{years} Years</span>
              </div>
              <input
                type="range"
                min="1"
                max="35"
                step="1"
                value={years}
                onChange={e => setYears(Number(e.target.value))}
                className="w-full accent-[#0b3d2e] cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between font-semibold text-[#16251f] mb-1">
                <span>EPF Annual Interest Rate</span>
                <span className="text-[#0b3d2e]">{interestRate}%</span>
              </div>
              <input
                type="number"
                step="0.05"
                value={interestRate}
                onChange={e => setInterestRate(Number(e.target.value))}
                className="w-full p-2 border border-[#c9ddd3] rounded-lg bg-[#fcfdfd]"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Big Result Card */}
          <div className="bg-gradient-to-br from-[#0b3d2e] to-[#14573f] text-white p-6 rounded-2xl shadow-md space-y-4">
            <span className="text-xs uppercase font-bold text-[#dff3e8] tracking-wider">
              Projected Retirement Corpus
            </span>
            <div className="text-4xl font-extrabold tracking-tight">
              ₹{results.projectedCorpus.toLocaleString('en-IN')}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/20 text-xs">
              <div>
                <span className="text-white/70 block text-[11px]">Your Contributions</span>
                <span className="font-bold text-sm">₹{results.totalEmployee.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-white/70 block text-[11px]">Employer Share</span>
                <span className="font-bold text-sm">₹{results.totalEmployer.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-white/70 block text-[11px]">Compounded Interest</span>
                <span className="font-bold text-sm text-[#ffd400]">
                  ₹{results.totalInterest.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Yearly Milestones */}
          <div className="bg-white p-5 rounded-xl border border-[#c9ddd3] shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-[#12233f] uppercase tracking-wider">
              Year-by-Year Growth Trajectory
            </h3>
            <div className="max-h-60 overflow-y-auto divide-y divide-[#f5f9f7] text-xs">
              {results.yearlyData.map(y => (
                <div key={y.year} className="py-2 flex items-center justify-between">
                  <span className="font-medium text-[#16251f]">Year {y.year}</span>
                  <div className="text-right">
                    <span className="font-bold text-[#0b3d2e]">
                      ₹{y.closingBalance.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-[#4b5f56] block">
                      +₹{y.interest.toLocaleString('en-IN')} interest
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
