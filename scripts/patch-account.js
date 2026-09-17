import fs from 'fs';

const newWm = `function wm({mode:e="signup",subjectId:t}){
  let n=e==="signup",
      r=Re.find(e=>e.id===t),
      i=r?"?disciplina="+r.id:"";

  let [name,setName]=(0,C.useState)(""),
      [email,setEmail]=(0,C.useState)(""),
      [password,setPassword]=(0,C.useState)(""),
      [whatsapp,setWhatsapp]=(0,C.useState)(""),
      [cidade,setCidade]=(0,C.useState)(""),
      [loading,setLoading]=(0,C.useState)(!1),
      [errorMsg,setErrorMsg]=(0,C.useState)(""),
      [successMsg,setSuccessMsg]=(0,C.useState)("");

  async function handleSubmit(ev){
    if(ev&&ev.preventDefault)ev.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if(n){
      if(!name.trim()||name.trim().length<2){
        setErrorMsg("Por favor, informe seu nome completo.");
        return;
      }
      if(!email.trim()||!email.includes("@")||!email.includes(".")){
        setErrorMsg("Por favor, informe um e-mail válido.");
        return;
      }
      if(!password||password.length<6){
        setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if(!whatsapp.trim()||whatsapp.trim().length<8){
        setErrorMsg("Por favor, informe seu WhatsApp com DDD.");
        return;
      }
      if(!cidade.trim()||cidade.trim().length<2){
        setErrorMsg("Por favor, informe sua cidade.");
        return;
      }

      setLoading(!0);
      try{
        let fb=window.FirebaseApplet;
        let u=null;
        if(fb&&fb.registerUser){
          u=await fb.registerUser({
            name:name.trim(),
            email:email.trim(),
            password:password,
            whatsapp:whatsapp.trim(),
            cidade:cidade.trim()
          });
        } else {
          let res=await fetch("/api/auth/register",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
              name:name.trim(),
              email:email.trim(),
              password:password,
              whatsapp:whatsapp.trim(),
              cidade:cidade.trim()
            })
          });
          let data=await res.json();
          if(!res.ok||!data.success) throw new Error(data.error||"Erro ao cadastrar.");
          u=data.user;
          localStorage.setItem("missao_aprovacao_auth_user",JSON.stringify(u));
        }

        setSuccessMsg("Conta criada com sucesso! Bem-vindo(a), "+name.trim()+"! Entrando...");
        setTimeout(()=>{
          window.location.href=Cm(t);
        },1000);
      } catch(err){
        console.error("Cadastro erro:",err);
        setErrorMsg(err.message||"Não foi possível criar sua conta.");
      } finally {
        setLoading(!1);
      }
    } else {
      if(!email.trim()||!password){
        setErrorMsg("Informe seu e-mail e senha.");
        return;
      }
      setLoading(!0);
      try {
        let fb=window.FirebaseApplet;
        let u=null;
        if(fb&&fb.loginWithEmail){
          u=await fb.loginWithEmail(email.trim(),password);
        } else {
          let res=await fetch("/api/auth/login",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({email:email.trim(),password:password})
          });
          let data=await res.json();
          if(!res.ok||!data.success) throw new Error(data.error||"E-mail ou senha incorretos.");
          u=data.user;
          localStorage.setItem("missao_aprovacao_auth_user",JSON.stringify(u));
        }

        setSuccessMsg("Login realizado com sucesso! Entrando...");
        setTimeout(()=>{
          window.location.href=Cm(t);
        },800);
      } catch(err){
        console.error("Login erro:",err);
        setErrorMsg(err.message||"E-mail ou senha incorretos.");
      } finally {
        setLoading(!1);
      }
    }
  }

  return (0,G.jsxs)("div",{
    className:"landing account-page",
    children:[
      (0,G.jsxs)("header",{
        className:"lp-wrap account-header",
        children:[
          (0,G.jsx)(ct,{}),
          (0,G.jsxs)("a",{
            href:"/",
            className:"account-back",
            children:[(0,G.jsx)(k,{size:17}),"Voltar ao início"]
          })
        ]
      }),
      (0,G.jsxs)("main",{
        className:"account-main",
        children:[
          (0,G.jsxs)("section",{
            className:"account-intro",
            children:[
              (0,G.jsx)("span",{className:"lp-eyebrow",children:"A PRÓXIMA DESCOBERTA É SUA"}),
              (0,G.jsxs)("h1",{children:["Um pequeno passo.",(0,G.jsx)("br",{}),"Um mundo de possibilidades."]}),
              (0,G.jsx)("p",{children:"Tico já está pronto para acompanhar sua jornada. Cadastre-se gratuitamente para salvar seu progresso, fases e redações."}),
              (0,G.jsxs)("div",{
                className:"account-art",
                children:[
                  (0,G.jsxs)("div",{children:["Seu futuro agradece",(0,G.jsx)("br",{}),(0,G.jsx)("strong",{children:"o passo de hoje!"})]}),
                  (0,G.jsx)(Le,{pose:0,size:310})
                ]
              }),
              (0,G.jsxs)("div",{
                className:"account-promise",
                children:[
                  (0,G.jsx)(Te,{size:21}),
                  (0,G.jsx)("span",{children:"21 fases · 7 disciplinas · novas descobertas"})
                ]
              })
            ]
          }),
          (0,G.jsxs)("section",{
            className:"account-card",
            "aria-labelledby":"account-title",
            children:[
              (0,G.jsxs)("nav",{
                className:"account-tabs",
                "aria-label":"Acesso ao jogo",
                children:[
                  (0,G.jsx)("a",{href:"/cadastro"+i,"aria-current":n?"page":void 0,children:"Criar conta"}),
                  (0,G.jsx)("a",{href:"/entrar"+i,"aria-current":n?void 0:"page",children:"Entrar"})
                ]
              }),
              (0,G.jsx)("span",{className:"account-free-badge",children:"✨ 100% GRATUITO · SALVAMENTO NA NUVEM"}),
              (0,G.jsx)("h2",{id:"account-title",children:n?"Sua jornada rumo à posse começa aqui.":"Que bom ter você de volta!"}),
              (0,G.jsx)("p",{children:n?"Preencha seus dados para criar sua conta de estudante.":"Acesse sua conta para continuar sua trilha de estudos."}),
              errorMsg && (0,G.jsx)("div",{className:"account-alert-error",children:errorMsg}),
              successMsg && (0,G.jsx)("div",{className:"account-alert-success",children:successMsg}),
              (0,G.jsxs)("form",{
                onSubmit:handleSubmit,
                children:[
                  n && (0,G.jsxs)("label",{
                    className:"account-field",
                    children:[
                      "Nome completo",
                      (0,G.jsxs)("span",{
                        children:[
                          (0,G.jsx)(ke,{size:18}),
                          (0,G.jsx)("input",{
                            type:"text",
                            required:!0,
                            autoComplete:"name",
                            placeholder:"Ex: Mariana Silva",
                            value:name,
                            onChange:e=>setName(e.target.value)
                          })
                        ]
                      })
                    ]
                  }),
                  (0,G.jsxs)("label",{
                    className:"account-field",
                    children:[
                      "Seu e-mail",
                      (0,G.jsxs)("span",{
                        children:[
                          (0,G.jsx)(le,{size:18}),
                          (0,G.jsx)("input",{
                            type:"email",
                            required:!0,
                            autoComplete:"email",
                            placeholder:"voce@exemplo.com",
                            value:email,
                            onChange:e=>setEmail(e.target.value)
                          })
                        ]
                      })
                    ]
                  }),
                  (0,G.jsxs)("label",{
                    className:"account-field",
                    children:[
                      "Sua senha",
                      (0,G.jsxs)("span",{
                        children:[
                          (0,G.jsx)(se,{size:18}),
                          (0,G.jsx)("input",{
                            type:"password",
                            required:!0,
                            autoComplete:n?"new-password":"current-password",
                            placeholder:"Mínimo 6 caracteres",
                            value:password,
                            onChange:e=>setPassword(e.target.value)
                          })
                        ]
                      })
                    ]
                  }),
                  n && (0,G.jsxs)("label",{
                    className:"account-field",
                    children:[
                      "WhatsApp com DDD",
                      (0,G.jsxs)("span",{
                        children:[
                          (0,G.jsx)(we,{size:18}),
                          (0,G.jsx)("input",{
                            type:"tel",
                            required:!0,
                            autoComplete:"tel",
                            placeholder:"Ex: (11) 98765-4321",
                            value:whatsapp,
                            onChange:e=>setWhatsapp(e.target.value)
                          })
                        ]
                      })
                    ]
                  }),
                  n && (0,G.jsxs)("label",{
                    className:"account-field",
                    children:[
                      "Cidade e Estado (UF)",
                      (0,G.jsxs)("span",{
                        children:[
                          (0,G.jsx)(ue,{size:18}),
                          (0,G.jsx)("input",{
                            type:"text",
                            required:!0,
                            autoComplete:"address-level2",
                            placeholder:"Ex: Brasília - DF ou Fortaleza - CE",
                            value:cidade,
                            onChange:e=>setCidade(e.target.value)
                          })
                        ]
                      })
                    ]
                  }),
                  (0,G.jsx)("button",{
                    type:"submit",
                    className:"account-submit-btn",
                    disabled:loading,
                    children:loading ? (0,G.jsx)("span",{children:"Aguarde..."}) : (n ? "Criar minha conta" : "Entrar na minha conta")
                  })
                ]
              }),
              (0,G.jsx)("div",{
                className:"account-divider",
                children:(0,G.jsx)("span",{children:"Ou continue direto no navegador"})
              }),
              r && (0,G.jsxs)("p",{
                className:"account-selected",
                children:["Seu destino: ",(0,G.jsx)("strong",{children:r.title})]
              }),
              (0,G.jsxs)("a",{
                className:"lp-cta",
                href:Cm(t),
                children:["Jogar agora sem login",(0,G.jsx)(A,{size:19})]
              }),
              (0,G.jsx)("small",{
                children:"Você pode criar sua conta a qualquer momento para salvar seu histórico na nuvem."
              })
            ]
          })
        ]
      })
    ]
  });
}`;

function patchFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const start = code.indexOf('function wm(');
  const end = code.indexOf('function Tm(', start);

  if (start === -1 || end === -1) {
    throw new Error(`Could not find function wm in ${filePath}`);
  }

  code = code.substring(0, start) + newWm + code.substring(end);
  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`Successfully patched ${filePath}`);
}

patchFile('public/assets/index-Dl2uwfPA.js');
patchFile('assets/index-Dl2uwfPA.js');
